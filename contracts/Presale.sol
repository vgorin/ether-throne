pragma solidity 0.4.23;

import "./Bitmaps.sol";
import "./RandomSeq.sol";
import "./CharacterCard.sol";

/**
 * @notice A crowdsale-like smart contract, responsible for selling
 *      character cards (`CharacterCard` ERC721 non-fungible tokens)
 * @dev Referenced as "card sale smart contract" below
 */
contract Presale {
  /// @dev Using library Bitmaps for bitmap arrays
  using Bitmaps for uint256[];

  /// @dev Using library RandomSeq for its internal structure
  using RandomSeq for RandomSeq.Buffer;

  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant PRESALE_VERSION = 0x4;

  /// @dev Version of the CharacterCard smart contract to work with
  /// @dev See `CharacterCard.version`/`CharacterCard.version()`
  uint32 public constant CHAR_CARD_VERSION_REQUIRED = 0xB;

  /// @dev ID of the first card to sell
  uint16 public constant OFFSET = 0x401;

  /// @dev Total number of cards to sell in the presale
  /// @dev Last card ID to sell is OFFSET + LENGTH - 1
  uint16 public constant LENGTH = TOTAL_CARDS;

  /// @dev Six different card types defined in presale:

  /// @dev Hologram card, has 10 attributes
  uint8 public constant RARITY_HOLOGRAM = 10;
  /// @dev Legendary card, has 8 attributes
  uint8 public constant RARITY_LEGENDARY = 8;
  /// @dev Ultra rare card, has 6 attributes
  uint8 public constant RARITY_ULTRA_RARE = 6;
  /// @dev Rare card, has 5 attributes
  uint8 public constant RARITY_RARE = 5;
  /// @dev Usual card, has only 3 attributes
  uint8 public constant RARITY_USUAL = 3;

  uint16 public constant TOTAL_CARDS = 4000;
  uint16 public constant HOLOGRAM_CARDS = 4;
  uint16 public constant HOLOGRAM_OR_HIGHER = HOLOGRAM_CARDS;
  uint16 public constant LEGENDARY_CARDS = 8;
  uint16 public constant LEGENDARY_OR_HIGHER = LEGENDARY_CARDS + HOLOGRAM_CARDS; // 12
  uint16 public constant ULTRA_RARE_CARDS = 16;
  uint16 public constant ULTRA_RARE_OR_HIGHER = ULTRA_RARE_CARDS + LEGENDARY_OR_HIGHER; // 28
  uint16 public constant RARE_CARDS = 32;
  uint16 public constant RARE_OR_HIGHER = RARE_CARDS + ULTRA_RARE_OR_HIGHER; // 60
  uint16 public constant USUAL_CARDS = TOTAL_CARDS - RARE_OR_HIGHER; // 3940

  /// @dev A bitmap representing all the issued tokens
  /// @dev Consists of 256 256-bit numbers – 65536 bits in total,
  ///      each bit represents a token existence flag,
  ///      0 - token doesn't exist, 1 - token exists
  /// @dev If token with ID `id` [1024, 65536) exists, then
  ///      `bitmap[id / 256] << (255 - (id % 256)) >> (255 - (id % 256)) >> (id % 256)` is equal to one
  /// @dev Initial size 16x256 = 4096 - enough to store 4000 cards to sell
  uint256[] public bitmap = new uint256[](16);

  /// @dev Maps card rarity to a buffer of available cards for that rarity
  mapping(uint8 => RandomSeq.Buffer) private cardBuckets;

  /// @dev CharacterCard deployed ERC721 instance
  /// @dev Used to mint cards
  /// @dev Card sale smart contract must have appropriate permissions
  ///      on the deployed CharacterCard
  CharacterCard public cardInstance;

  /// @dev Beneficiary address, used to send collected funds to
  address public beneficiary;

  /// @dev Number of cards sold, next card to sell number is `sold + OFFSET`
  uint16 public sold;

  /// @dev Price of the first card to sell (initial price of the card)
  /// @dev Next cards' price may differ, it can be a function of cards sold,
  ///      number of cards sold in a single transaction and so on.
  ///      This behaviour is defined in the `nextPrice()` function
  /// @dev This value is updated after each successful card purchase
  uint256 public currentPrice = 50 finney;

  /// @dev Emits when smart contract sells a card, buy(), buyFor()
  event PurchaseComplete(address indexed from, address indexed to, uint16 amount);

  /**
   * @dev Creates a card sale smart contract instance
   * @param tokenAddress address of the deployed CharacterCard ERC721 token instance,
   *      used to mint card instances (delegates a call to `CharacterCard.mintWith function`)
   * @param _beneficiary address of the beneficiary,
   *      used to send collected funds to
   */
  constructor(address tokenAddress, address _beneficiary) public {
    // basic input validation
    require(tokenAddress != address(0));
    require(_beneficiary != address(0));
    require(tokenAddress != _beneficiary);

    // link the character card instance
    cardInstance = CharacterCard(tokenAddress);

    // validate if character card instance is valid
    // by validating smart contract version
    require(CHAR_CARD_VERSION_REQUIRED == cardInstance.CHAR_CARD_VERSION());

    // setup all the parameters left
    beneficiary = _beneficiary;

    // set the bitmap to ones - available cards
    bitmap.flip();

    // initialize card buffers
    __initCardBuffers();
  }

  /**
   * @dev A convenient function to retrieve 1kb of character bitmap data
   * @return 1kb of issued cards IDs bitmap data
   */
  function getBitmapSegment() public constant returns(uint256[]) {
    // delegate call to `bitmap.bulkGet`
    return bitmap.bulkGet(0, 16);
  }

  /// @dev Allows to retrieve cards available for sale right now
  function availableCards(uint8 rarity) public constant returns(uint16[]) {
    // just read the buffer and return its contents
    return cardBuckets[rarity].buffer;
  }

  /// @dev Updates the price of the next card to sell
  function update(uint16 soldDelta) private {
  /*
    Initial pre-sale cost will start at 0.05 ETH, increasing 0.01 ETH every 20 character cards sold
    until reaching 0.25 ETH. Once reached, it will remain until the first 1000 cards are sold
    and after that the value of the cards will increase to 0.3 ETH for the next 1000,
    0.35 ETH for the next 1000 and 0.4 ETH for the next 500 and 0.45 ETH for the final 500 cards.
  */

    // Initial pre-sale cost will start at 0.05 ETH,
    if(currentPrice < 250 finney && sold / 20 != (sold + soldDelta) / 20) {
      // increasing 0.01 ETH every 20 character cards sold until reaching 0.25 ETH
      currentPrice += 10 finney;
    }
    // Once reached, it will remain until the first 1000 cards are sold
    else if(sold < 1000 && sold + soldDelta >= 1000) {
      // and after that the value of the cards will increase to 0.3 ETH for the next 1000,
      currentPrice = 300 finney;
    }
    // 0.35 ETH for the next 1000
    else if(sold < 2000 && sold + soldDelta >= 2000) {
      currentPrice = 350 finney;
    }
    // and 0.4 ETH for the next 500
    else if(sold < 3000 && sold + soldDelta >= 3000) {
      currentPrice = 400 finney;
    }
    // and 0.45 ETH for the final 500 cards
    else if(sold < 3500 && sold + soldDelta >= 3500) {
      currentPrice = 450 finney;
    }

    // update sold counter
    sold += soldDelta;
  }

  /// @dev Accepts a payment and sends a specific card back to the sender
  function buyUsual(uint16 index, uint16 cardId) public payable {
    // just delegate call to `buyRandomFor`
    buyUsualFor(msg.sender, index, cardId);
  }

  /// @dev Accepts a payment and sends a specific card to the player
  function buyUsualFor(address to, uint16 index, uint16 cardId) public payable {
    // validate the card recipient address
    require(to != address(0));
    require(to != address(this));

    // calculate price of the specific card, its higher then random
    uint256 specificPrice = 5 * currentPrice; // 400% extra charge

    // there should be enough value received to buy specific card
    require(msg.value >= specificPrice);

    // delegate call to `__issueUsualCard`
    __issueUsualCard(to, index, cardId);
  }

  /// @dev Accepts a payment and sends card(s) back to the sender
  function buyRandom() public payable {
    // just delegate call to `buyRandomFor`
    buyRandomFor(msg.sender);
  }

  /// @dev Accepts a payment and sends card(s) to the player
  function buyRandomFor(address to) public payable {
    // validate the card recipient address
    require(to != address(0));
    require(to != address(this));

    // calculate price of the three cards in a single transaction
    uint256 triplePrice = 2 * currentPrice; // 33% discount

    // amount of funds we received from player in this transaction
    uint256 valueReceived = msg.value;

    // there should be enough value received to buy at least one card
    require(valueReceived >= currentPrice);

    // total price of the cards to send
    uint256 totalPrice = currentPrice;

    // if the value received is not enough to buy three cards
    // (33% discount) or we don't have three cards to sell left
    // we sell only one card, otherwise we sell three cards
    if(valueReceived < triplePrice || TOTAL_CARDS - sold < 3) {
      // issue one card
      __issueRandomCard(to);
    }
    else {
      // update total price of the three cards to sell
      totalPrice = triplePrice;

      // issue three cards
      __issueThreeRandomCards(to);
    }

    // calculate amount of change to return to the player
    uint256 change = valueReceived - totalPrice;

    // transfer the funds to the beneficiary
    beneficiary.transfer(totalPrice);

    // transfer the change (if any) back to the player
    if(change > 0) {
      to.transfer(change);
    }

    // emit an `PurchaseComplete` event
    emit PurchaseComplete(msg.sender, to, totalPrice == currentPrice ? 1: 3);
  }

  /// @dev Issue a specific usual card to the address `to`
  function __issueUsualCard(address to, uint16 index, uint16 cardId) private {
    // only usual cards are available for this price
    require(cardId >= OFFSET + RARE_OR_HIGHER);

    // pop the card from the buffer
    uint16 actualId = cardBuckets[RARITY_USUAL].pop(index);

    // check if this is the desired card
    require(actualId == cardId);

    // mint the card
    cardInstance.mintWith(to, cardId, RARITY_USUAL);

    // update the bitmask of sold cards
    bitmap.disable(cardId - OFFSET);

    // update presale state: `sold` cards count and `currentPrice`
    update(1);
  }


  /// @dev Issue rare card to the address `to`
  function __issueRareCard(address to, uint8 rarity) private {
    // get some randomness to init card rarity
    // this randomness is not cryptographically secure of course
    // and may be heavily influenced by miners, but its cheap though
    uint256 randomness = RandomSeq.__rawRandom();

    // pick random card
    uint16 cardId = cardBuckets[rarity].nextRandomWith(randomness);

    // mint the card
    cardInstance.mintWith(to, cardId, rarity);

    // update the bitmask of sold cards
    bitmap.disable(cardId - OFFSET);

    // update presale state: `sold` cards count and `currentPrice`
    update(1);
  }

  /// @dev Issue one card to the address `to`
  function __issueRandomCard(address to) private {
    // get some randomness to init card rarity
    // this randomness is not cryptographically secure of course
    // and may be heavily influenced by miners, but its cheap though
    uint256 randomness = RandomSeq.__rawRandom();

    // pick random rarity
    uint8 rarity = __randomRarity(randomness);
    // pick random card
    uint16 cardId = __randomCard(randomness >> 32, rarity);

    // mint the card
    cardInstance.mintWith(to, cardId, rarity);

    // update the bitmask of sold cards
    bitmap.enable(cardId - OFFSET);

    // update presale state: `sold` cards count and `currentPrice`
    update(1);
  }

  /// @dev Issue three cards to the address `to`
  function __issueThreeRandomCards(address to) private {
    // get some randomness to init card rarity
    // this randomness is not cryptographically secure of course
    // and may be heavily influenced by miners, but its cheap though
    uint256 randomness = RandomSeq.__rawRandom();

    // pick 3 random cards and their rarities
    // using low 64 bits of `randomness`
    // pick random rarity 1
    uint8 rarity1 = __randomRarity(randomness);
    // pick random card 1
    uint16 card1Id = __randomCard(randomness >> 32, rarity1);

    // next 64 bits of `randomness`
    // pick random rarity 2
    uint8 rarity2 = __randomRarity(randomness >> 64);
    // pick random card 3
    uint16 card2Id = __randomCard(randomness >> 96, rarity2);

    // next 64 bits of `randomness`
    // pick random rarity 2
    uint8 rarity3 = __randomRarity(randomness >> 128);
    // pick random card 3
    uint16 card3Id = __randomCard(randomness >> 160, rarity3);
    // at this point yet another 64 bits of `randomness` has left

    // mint the cards
    cardInstance.mintCards(to, __pack3Cards(card1Id, rarity1, card2Id, rarity2, card3Id, rarity3));

    // update the bitmask of sold cards
    bitmap.disable(card1Id - OFFSET);
    bitmap.disable(card2Id - OFFSET);
    bitmap.disable(card3Id - OFFSET);

    // update presale state: `sold` cards count and `currentPrice`
    update(3);
  }

  /// @dev Packs 3 cards into an uint24[3] dynamic array
  function __pack3Cards(uint16 id1, uint32 r1, uint16 id2, uint32 r2, uint16 id3, uint32 r3) private pure returns (uint24[]) {
    uint24[] memory data = new uint24[](3);
    data[0] = __pack24(id1, r1);
    data[1] = __pack24(id2, r2);
    data[2] = __pack24(id3, r3);
    return data;
  }

  /// @dev Packs single card into uint24
  function __pack24(uint16 cardId, uint32 rarity) private pure returns (uint24) {
    // cardId (16 bits) | rarity (8 bits)
    return uint24(cardId) << 8 | uint8(0x1F & rarity);
  }

  /// @dev Initializes `cards` mapping
  function __initCardBuffers() private {
    // 4 hologram cards
    cardBuckets[RARITY_HOLOGRAM] = RandomSeq.createBuffer(OFFSET, HOLOGRAM_CARDS);
    // 8 legendary cards
    cardBuckets[RARITY_LEGENDARY] = RandomSeq.createBuffer(OFFSET + HOLOGRAM_CARDS, LEGENDARY_CARDS);
    // 16 ultra rare cards
    cardBuckets[RARITY_ULTRA_RARE] = RandomSeq.createBuffer(OFFSET + LEGENDARY_OR_HIGHER, ULTRA_RARE_CARDS);
    // 32 rare cards
    cardBuckets[RARITY_RARE] = RandomSeq.createBuffer(OFFSET + ULTRA_RARE_OR_HIGHER, RARE_CARDS);
    // 3940 usual cards
    cardBuckets[RARITY_USUAL] = RandomSeq.createBuffer(OFFSET + RARE_OR_HIGHER, USUAL_CARDS);
  }

  /// @dev Randomly picks up a card of the suggested rarity based on
  ///      32 bits of `randomness` given
  function __randomCard(uint256 randomness, uint8 rarity) private returns (uint16 cardId) {
    // based on the suggested `rarity` value get the card;
    // first, going down from more valuable cards to less valuable,
    // try to allocate the card based on the `rarity` value;
    // however its possible that cards of the requested rarity are already exhausted,
    // so we need some fallback to search all the card buckets
    if(rarity == RARITY_HOLOGRAM && cardBuckets[RARITY_HOLOGRAM].hasNext()) {
      // hologram card
      return cardBuckets[RARITY_HOLOGRAM].nextRandomWith(randomness);
    }
    else if(rarity == RARITY_LEGENDARY && cardBuckets[RARITY_LEGENDARY].hasNext()) {
      // legendary card
      return cardBuckets[RARITY_LEGENDARY].nextRandomWith(randomness);
    }
    else if(rarity == RARITY_ULTRA_RARE && cardBuckets[RARITY_ULTRA_RARE].hasNext()) {
      // ultra rare card
      return cardBuckets[RARITY_ULTRA_RARE].nextRandomWith(randomness);
    }
    else if(rarity == RARITY_RARE && cardBuckets[RARITY_RARE].hasNext()) {
      // rare card
      return cardBuckets[RARITY_RARE].nextRandomWith(randomness);
    }
    else {
      // at this point we'd like to pick up a usual card,
      // however if usual cards are exhausted we go up
      // to more valuable cards and pick up a card once possible
      if(cardBuckets[RARITY_USUAL].hasNext()) {
        // usual card
        return cardBuckets[RARITY_USUAL].nextRandomWith(randomness);
      }
      else if(cardBuckets[RARITY_RARE].hasNext()) {
        // rare card
        return cardBuckets[RARITY_RARE].nextRandomWith(randomness);
      }
      else if(cardBuckets[RARITY_ULTRA_RARE].hasNext()) {
        // ultra rare card
        return cardBuckets[RARITY_ULTRA_RARE].nextRandomWith(randomness);
      }
      else if(cardBuckets[RARITY_LEGENDARY].hasNext()) {
        // legendary card
        return cardBuckets[RARITY_LEGENDARY].nextRandomWith(randomness);
      }
      else {
        // at this point there should exist at least one hologram card,
        // otherwise it means that call card buckets are exhausted
        assert(cardBuckets[RARITY_HOLOGRAM].hasNext());

        // hologram card
        return cardBuckets[RARITY_HOLOGRAM].nextRandomWith(randomness);
      }
    }
  }

  /// @dev Randomly generates card rarity based on
  ///      32 bits of `randomness` given
  /// @dev probability of each type of cards is determined amount of each card available
  function __randomRarity(uint256 randomness) private pure returns (uint8 rarity) {
    // get random value in range [0, TOTAL_CARDS)
    uint256 raritySelector = RandomSeq.__rndVal(randomness, 0xFFFFFFFF, 0, TOTAL_CARDS);

    // based on the random value obtained determine the suggested rarity;
    if(raritySelector < HOLOGRAM_CARDS) {
      // hologram card
      return RARITY_HOLOGRAM;
    }
    else if(raritySelector < LEGENDARY_OR_HIGHER) {
      // legendary card
      return RARITY_LEGENDARY;
    }
    else if(raritySelector < ULTRA_RARE_OR_HIGHER) {
      // ultra rare card
      return RARITY_ULTRA_RARE;
    }
    else if(raritySelector < RARE_OR_HIGHER) {
      // rare card
      return RARITY_RARE;
    }
    else {
      // usual card
      return RARITY_USUAL;
    }
  }


}
