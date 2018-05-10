pragma solidity 0.4.23;

import "./RandomSeq.sol";
import "./CharacterCard.sol";

/**
 * @notice A crowdsale-like smart contract, responsible for selling
 *      character cards (`CharacterCard` ERC721 non-fungible tokens)
 * @dev Referenced as "card sale smart contract" below
 */
contract Presale {
  /// @dev Using library RandomSeq for its internal structure
  using RandomSeq for RandomSeq.Buffer;

  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant PRESALE_VERSION = 0x3;

  /// @dev Version of the CharacterCard smart contract to work with
  /// @dev See `CharacterCard.version`/`CharacterCard.version()`
  uint32 public constant CHAR_CARD_VERSION_REQUIRED = 0x9;

  /// @dev ID of the first card to sell
  uint16 public constant OFFSET = 1024;

  /// @dev Total number of cards to sell in the presale
  /// @dev Last card ID to sell is OFFSET + LENGTH - 1
  uint16 public constant LENGTH = TOTAL_CARDS;

  /// @dev Price of the first card to sell (initial price of the card)
  /// @dev Next cards' price may differ, it can be a function of cards sold,
  ///      number of cards sold in a single transaction and so on.
  ///      This behaviour is defined in the `nextPrice()` function
  uint256 public constant INITIAL_PRICE = 50 finney;

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

    // initialize card buffers
    __initCardBuffers();
  }

  /// @dev Calculates the price of the next card to sell
  function nextPrice() public pure returns (uint256) {
    /* // TODO: implement the following formula:
    Initial pre-sale cost will start at 0.05 ETH, increasing 0.01 ETH every 20 character cards sold
    until reaching 0.25 ETH. Once reached, it will remain until the first 1000 cards are sold
    and after that the value of the cards will increase to 0.3 ETH for the next 1000,
    0.35 ETH for the next 1000 and 0.4 ETH for the next 500 and 0.45 ETH for the final 500 cards.
    */
    // basic implementation just returns `initialPrice`
    return INITIAL_PRICE;
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

    // get the price of a single card in current transaction
    uint256 single = nextPrice();

    // calculate price of the three cards in a single transaction
    uint256 triple = 2 * single; // 33% discount

    // amount of funds we received from player in this transaction
    uint256 valueReceived = msg.value;

    // there should be enough value received to buy at least one card
    require(valueReceived >= single);

    // total price of the cards to send
    uint256 totalPrice = single;

    // if the value received is not enough to buy three cards
    // (33% discount) or we don't have three cards to sell left
    // we sell only one card, otherwise we sell three cards
    if(valueReceived < triple || TOTAL_CARDS - sold < 3) {
      // issue one card
      __issueSingleCard(to);
    }
    else {
      // update total price of the three cards to sell
      totalPrice = triple;

      // issue three cards
      __issueThreeCards(to);
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
    emit PurchaseComplete(msg.sender, to, totalPrice == single? 1: 3);
  }

  /// @dev Issue one card to the address `to`
  function __issueSingleCard(address to) private {
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

    // update `sold` cards counter accordingly
    sold++;
  }

  /// @dev Issue three cards to the address `to`
  function __issueThreeCards(address to) private {
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

    // update `sold` cards counter accordingly
    sold += 3;
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
    return uint24(cardId) << 16 | uint8(0x1F & rarity);
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
    if(rarity == HOLOGRAM_CARDS && cardBuckets[RARITY_HOLOGRAM].hasNext()) {
      // hologram card
      return cardBuckets[RARITY_HOLOGRAM].nextRandomWith(randomness);
    }
    else if(rarity == LEGENDARY_OR_HIGHER && cardBuckets[RARITY_LEGENDARY].hasNext()) {
      // legendary card
      return cardBuckets[RARITY_LEGENDARY].nextRandomWith(randomness);
    }
    else if(rarity == ULTRA_RARE_OR_HIGHER && cardBuckets[RARITY_ULTRA_RARE].hasNext()) {
      // ultra rare card
      return cardBuckets[RARITY_ULTRA_RARE].nextRandomWith(randomness);
    }
    else if(rarity == RARE_OR_HIGHER && cardBuckets[RARITY_RARE].hasNext()) {
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
