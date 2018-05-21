pragma solidity 0.4.23;

import "./Bitmaps.sol";
import "./CharacterCard.sol";

/**
 * @notice A crowdsale-like smart contract, responsible for selling
 *      character cards (`CharacterCard` ERC721 non-fungible tokens)
 * @dev Referenced as "card sale smart contract" below
 */
contract Presale {
  /// @dev Using library Bitmaps for bitmap arrays
  using Bitmaps for uint256[];

  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant PRESALE_VERSION = 0x9;

  /// @dev Version of the CharacterCard smart contract to work with
  /// @dev See `CharacterCard.CHAR_CARD_VERSION`
  uint32 public constant CHAR_CARD_VERSION_REQUIRED = 0xC;

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

  /// @dev Buying a specific card is expensive,
  ///      if compared to a random card price,
  ///      we use following price multipliers for
  ///      different type of cards:
  /// @dev Hologram card is 1000 times more expensive
  uint64 public constant HOLOGRAM_PRICE = 1000;
  /// @dev Legendary card is 500 times more expensive
  uint64 public constant LEGENDARY_PRICE = 500;
  /// @dev Ultra rare card is 250 times more expensive
  uint64 public constant ULTRA_RARE_PRICE = 250;
  /// @dev Rare card is 150 times more expensive
  uint64 public constant RARE_PRICE = 150;
  /// @dev Usual card is 10 times more expensive,
  ///      if buying a specific card, not random
  uint64 public constant USUAL_PRICE = 10;

  /// @dev ID of the first card to sell is 1025
  uint16 public constant FIRST_CARD_ID = 0x401;
  /// @dev Total number of cards for sale is 4000, including
  uint16 public constant TOTAL_CARDS = 4000;

  /// @dev 4 hologram cards, IDs 1025-1028
  uint16 public constant HOLOGRAM_CARDS = 4;
  uint16 public constant HOLOGRAM_OR_HIGHER = HOLOGRAM_CARDS;
  /// @dev 8 legendary cards, IDs 1029-1036
  uint16 public constant LEGENDARY_CARDS = 8;
  uint16 public constant LEGENDARY_OR_HIGHER = LEGENDARY_CARDS + HOLOGRAM_CARDS; // 12
  /// @dev 16 ultra rare cards, IDs 1037-1052
  uint16 public constant ULTRA_RARE_CARDS = 16;
  uint16 public constant ULTRA_RARE_OR_HIGHER = ULTRA_RARE_CARDS + LEGENDARY_OR_HIGHER; // 28
  /// @dev 32 rare cards, IDs 1053-1084
  uint16 public constant RARE_CARDS = 32;
  uint16 public constant RARE_OR_HIGHER = RARE_CARDS + ULTRA_RARE_OR_HIGHER; // 60
  /// @dev Rest 3940 cards are usual cards, IDs 1085-5024
  uint16 public constant USUAL_CARDS = TOTAL_CARDS - RARE_OR_HIGHER; // 3940

  /// @dev An array containing the IDs of all the cards available for sale
  uint16[] public cardsForSale;

  /// @dev A mapping containing all the moved cards within a `cardsForSale` array
  mapping(uint16 => uint256) public movedCards;

  /// @dev A bitmap representing all the issued tokens
  /// @dev Consists of 256 256-bit numbers – 65536 bits in total,
  ///      each bit represents a token existence flag,
  ///      0 - token doesn't exist, 1 - token exists
  /// @dev If token with ID `id` [1024, 65536) exists, then
  ///      `bitmap[id / 256] << (255 - (id % 256)) >> (255 - (id % 256)) >> (id % 256)` is equal to one
  /// @dev Initial size 16x256 = 4096 - enough to store 4000 cards to sell
  uint256[] public bitmap = new uint256[](16);

  /// @dev CharacterCard deployed ERC721 instance
  /// @dev Used to mint cards
  /// @dev Card sale smart contract must have appropriate permissions
  ///      on the deployed CharacterCard
  CharacterCard public cardInstance;

  /// @dev True if `cardsForSale` was successfully initialized
  bool public initialized;

  /// @dev Number of cards sold, next card to sell number is `sold + OFFSET`
  uint16 public sold;

  /// @dev Price of the first card to sell (initial price of the card)
  /// @dev Next cards' price may differ, it can be a function of cards sold,
  ///      number of cards sold in a single transaction and so on.
  ///      This behaviour is defined in the `nextPrice()` function
  /// @dev This value is updated after each successful card purchase
  uint64 public currentPrice = 50 finney;

  /// @dev Contains previous value of `currentPrice`
  uint64 public lastPrice;

  /// @dev Beneficiary address, used to send collected funds to
  address public beneficiary;

  /// @dev Emits when smart contract sells a card, buy(), buyFor()
  event PurchaseComplete(address indexed from, address indexed to, uint16 quantity, uint256 totalPrice);

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
    bitmap.flipAll();

    // trim the bitmap to fit the length - TOTAL_CARDS
    bitmap.trim(TOTAL_CARDS);
  }

  /// @dev Initializes `cardsForSale` array
  /// @dev Should be called right after deployment several times
  ///      until initialized
  function init(uint16 delta) public {
    // check that presale is not initialized yet
    require(!initialized);

    // current length of `cardsForSale`
    uint16 currentLength = uint16(cardsForSale.length);

    // current offset to generate card IDs from
    uint16 offset = FIRST_CARD_ID + currentLength;

    // how much card IDs left to initialize
    uint16 left = TOTAL_CARDS - currentLength;

    // no need to initialize more then `left` elements
    if(delta > left) {
      delta = left;
    }

    // perform the initialization
    for(uint16 i = 0; i < delta; i++) {
      cardsForSale.push(offset + i);
    }

    // update `initialized` flag
    initialized = cardsForSale.length == TOTAL_CARDS;
  }

  /// @dev Calculates how many cards left for sale, `TOTAL_CARDS` minus `sold`
  function left() public constant returns (uint16) {
    // calculate the diff and return
    return TOTAL_CARDS - sold;
  }

  /// @dev A convenient function to retrieve available cards bitmap data
  /// @dev Making _bitmap public is not convenient since Solidity creates
  ///      a parametrized getter in that case
  function getBitmap() public constant returns(uint256[]) {
    // just return whole array
    return bitmap;
  }

  /// @dev Calculates card price by ID at the current moment of presale
  function specificPrice(uint16 tokenId) public constant returns (uint64) {
    // verify that this card is available for sale
    require(available(tokenId));

    // specific price is derived from `currentPrice` by applying a multiplier
    return __priceMultiplier(tokenId) * currentPrice;
  }

  /// @dev Checks if particular card is available for sale
  function available(uint16 tokenId) public constant returns (bool) {
    // within a bounds of card IDs available in a presale
    bool result = tokenId > FIRST_CARD_ID && tokenId < FIRST_CARD_ID + TOTAL_CARDS &&
                  // try to locate the card in the array first
                  (tokenId < FIRST_CARD_ID + cardsForSale.length
                  // if it wasn't moved - we're fine, card is found
                  && cardsForSale[tokenId - FIRST_CARD_ID] == tokenId
                  // if it was moved - try to locate it in the `movedCards` map
                  || cardsForSale[movedCards[tokenId]] == tokenId);

    // return the result
    return result;
  }

  /// @dev Returns the presale status data as a packed uint144 tuple structure
  function getPacked() public constant returns (uint144) {
    // pack and return
    return uint144(sold) << 128 | uint128(currentPrice) << 64 | lastPrice;
  }

  /// @dev Accepts a payment and sends a specific card back to the sender
  function buySpecific(uint16 tokenId) public payable {
    // presale must be initialized
    require(initialized);

    // just delegate call to `buySpecificFor`
    buySpecificFor(msg.sender, tokenId);
  }

  /// @dev Accepts a payment and sends a specific card to the player
  function buySpecificFor(address to, uint16 tokenId) public payable {
    // presale must be initialized
    require(initialized);

    // validate the card recipient address
    require(to != address(0));
    require(to != address(this));

    // calculate price of the specific card, its higher then random
    uint256 price = specificPrice(tokenId);

    // amount of funds we received from player in this transaction
    uint256 valueReceived = msg.value;

    // there should be enough value received to buy specific card
    require(valueReceived >= price);

    // pop the card from the buffer
    __popById(tokenId);

    // mint the card
    cardInstance.mintWith(to, tokenId, RARITY_USUAL);

    // update the bitmask of sold cards
    bitmap.disable(tokenId - FIRST_CARD_ID);

    // update presale state: `sold` cards count and `currentPrice`
    __update(1);

    // calculate amount of change to return to the player
    uint256 change = valueReceived - price;

    // transfer the funds to the beneficiary
    beneficiary.transfer(price);

    // transfer the change (if any) back to the buyer
    if(change > 0) {
      msg.sender.transfer(change);
    }

    // emit an `PurchaseComplete` event
    emit PurchaseComplete(msg.sender, to, 1, price);
  }

  /// @dev Accepts a payment and sends card(s) back to the sender
  function buyRandom() public payable {
    // presale must be initialized
    require(initialized);

    // just delegate call to `buyRandomFor`
    buyRandomFor(msg.sender);
  }

  /// @dev Accepts a payment and sends card(s) to the player
  function buyRandomFor(address to) public payable {
    // presale must be initialized
    require(initialized);

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

    // get some randomness to work pick up a card randomly
    // this randomness is not cryptographically secure of course
    // and may be heavily influenced by miners, but its cheap though
    uint256 randomness = __rawRandom();

    // if the value received is not enough to buy three cards
    // (33% discount) or we don't have three cards to sell left
    // we sell only one card, otherwise we sell three cards
    if(valueReceived < triplePrice || TOTAL_CARDS - sold < 3) {
      // issue one card

      // pick random card
      uint16 cardId = __popRandom(uint32(randomness));

      // mint the card
      cardInstance.mintWith(to, cardId, __rarity(cardId));

      // update the bitmask of sold cards
      bitmap.disable(cardId - FIRST_CARD_ID);

      // update presale state: `sold` cards count and `currentPrice`
      __update(1);
    }
    else {
      // issue three cards

      // update total price of the three cards to sell
      totalPrice = triplePrice;

      // pick 3 random cards
      // using low 32 bits of `randomness`
      // pick random card 1
      uint16 card1Id = __popRandom(uint32(randomness));

      // next 32 bits of `randomness`
      // pick random card 2
      uint16 card2Id = __popRandom(uint32(randomness >> 32));

      // next 32 bits of `randomness`
      // pick random card 3
      uint16 card3Id = __popRandom(uint32(randomness >> 64));

      // mint the cards
      cardInstance.mintCards(to, __pack3Cards(card1Id, card2Id, card3Id));

      // update the bitmask of sold cards
      bitmap.disable(card1Id - FIRST_CARD_ID);
      bitmap.disable(card2Id - FIRST_CARD_ID);
      bitmap.disable(card3Id - FIRST_CARD_ID);

      // update presale state: `sold` cards count and `currentPrice`
      __update(3);
    }

    // calculate amount of change to return to the player
    uint256 change = valueReceived - totalPrice;

    // transfer the funds to the beneficiary
    beneficiary.transfer(totalPrice);

    // transfer the change (if any) back to the buyer
    if(change > 0) {
      msg.sender.transfer(change);
    }

    // emit an `PurchaseComplete` event
    emit PurchaseComplete(msg.sender, to, totalPrice == currentPrice ? 1: 3, totalPrice);
  }

  /// @dev Updates the price of the next card to sell
  function __update(uint16 soldDelta) private {
    // save current `currentPrice` value
    lastPrice = currentPrice;

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

  /// @dev Removes random card from `cardsForSale`
  function __popRandom(uint32 randomness) private returns (uint16) {
    // using 32 bits of randomness provided, pick random index
    uint256 index = __rndVal(randomness, 0xFFFFFFFF, 0, cardsForSale.length);

    // delegate call to `__popCard` to remove the card from buffer
    return __popByIndex(index);
  }

  /// @dev Removes a card from `cardsForSale` array, throws on invalid index
  function __popByIndex(uint256 index) private returns (uint16) {
    // there should be a card to pop from the  position defined by `index`
    require(cardsForSale.length > index);

    // id of the card to pop
    uint16 popId = cardsForSale[index];

    // the hole in the `cardsForSale` array which appears after the
    // card removal is filled by the last card in the array
    uint16 moveId = cardsForSale[cardsForSale.length - 1];

    // in order to be able to locate this card later,
    // we save the moved card position
    movedCards[moveId] = index;

    // fill the appeared hole
    cardsForSale[index] = moveId;

    // shrink the array which stores all the available card IDs
    cardsForSale.length--;

    // return the card ID
    return popId;
  }

  /// @dev Removes a card from `cardsForSale` array,
  ///      throws if it doesn't contain a given card
  function __popById(uint16 tokenId) private {
    // validate input
    require(tokenId >= FIRST_CARD_ID && tokenId < FIRST_CARD_ID + TOTAL_CARDS);

    // try to locate the card in the array first - if it wasn't moved
    if(tokenId < FIRST_CARD_ID + cardsForSale.length && cardsForSale[tokenId - FIRST_CARD_ID] == tokenId) {
      __popByIndex(tokenId - FIRST_CARD_ID);
    }
    // if it was moved - try to locate it in the `movedCards` map
    else {
      // read the position where a card was moved to
      uint256 index = movedCards[tokenId];

      // check if this position contains a valid card,
      // throw otherwise
      require(cardsForSale[index] == tokenId);

      // we've found a valid index, pop it
      __popByIndex(index);
    }
  }

  /// @dev Determine price multiplier of a card based on its ID
  function __priceMultiplier(uint16 tokenId) private pure returns (uint64) {
    // cards up to 1028
    if(tokenId < FIRST_CARD_ID + HOLOGRAM_OR_HIGHER) {
      return HOLOGRAM_PRICE;
    }
    // cards up to 1036
    if(tokenId < FIRST_CARD_ID + LEGENDARY_OR_HIGHER) {
      return LEGENDARY_PRICE;
    }
    // cards up to 1052
    if(tokenId < FIRST_CARD_ID + ULTRA_RARE_OR_HIGHER) {
      return ULTRA_RARE_PRICE;
    }
    // cards up to 1084
    if(tokenId < FIRST_CARD_ID + RARE_OR_HIGHER) {
      return RARE_PRICE;
    }
    // all the rest - cards up to 5024
    return USUAL_PRICE;
  }

  /// @dev Determine card rarity (number of attributes) of a card based on its ID
  function __rarity(uint16 tokenId) private pure returns (uint8) {
    // cards up to 1028
    if(tokenId < FIRST_CARD_ID + HOLOGRAM_OR_HIGHER) {
      return RARITY_HOLOGRAM;
    }
    // cards up to 1036
    if(tokenId < FIRST_CARD_ID + LEGENDARY_OR_HIGHER) {
      return RARITY_LEGENDARY;
    }
    // cards up to 1052
    if(tokenId < FIRST_CARD_ID + ULTRA_RARE_OR_HIGHER) {
      return RARITY_ULTRA_RARE;
    }
    // cards up to 1084
    if(tokenId < FIRST_CARD_ID + RARE_OR_HIGHER) {
      return RARITY_RARE;
    }
    // all the rest - cards up to 5024
    return RARITY_USUAL;
  }

  /// @dev Packs 3 cards into an uint24[3] dynamic array
  function __pack3Cards(uint16 id1, uint16 id2, uint16 id3) private pure returns (uint24[]) {
    uint24[] memory data = new uint24[](3);
    data[0] = __pack24(id1, __rarity(id1));
    data[1] = __pack24(id2, __rarity(id2));
    data[2] = __pack24(id3, __rarity(id3));
    return data;
  }

  /// @dev Packs single card into uint24
  function __pack24(uint16 cardId, uint32 rarity) private pure returns (uint24) {
    // cardId (16 bits) | rarity (8 bits)
    return uint24(cardId) << 8 | uint8(0x1F & rarity);
  }

  /**
   * @dev Extracts a random value in range [offset, offset + length),
   *      from the `randomness` given after applying a `mask`
   * @dev mask - maximum value the `randomness` can have,
   *      for example, if `randomness` is 32-bits long, `mask` = 0xFFFFFFFF,
   *                   if `randomness` is 16-bits long, `mask` = 0xFFFF
   * @param randomness source of randomness
   * @param mask maximum value the `randomness` can have
   * @param offset lower output bound
   * @param length number of possible output values, upper bound is `offset + length - 1`
   * @return random value in range [offset, offset + length)
   */
  function __rndVal(uint256 randomness, uint256 mask, uint256 offset, uint256 length) private pure returns (uint256) {
    // return random value in range [offset, offset + length)
    return offset + (mask & randomness) * length / (mask + 1);
  }

  /**
   * @dev Generates random value in range [offset, offset + length)
   *      based on the `__rawRandom` as a source of a randomness
   * @dev The random value generated is not cryptographically secure
   *      and may be heavily influenced by miners, but its cheap though
   * @param offset lower output bound
   * @param length number of possible output values, upper bound is `offset + length - 1`
   * @return random value in range [offset, offset + length)
   */
  function __randomValue(uint256 offset, uint256 length) private constant returns (uint256) {
    // using `__rawRandom` as a source of randomness,
    uint256 randomness = __rawRandom();

    // delegate call to `__rndVal` using only 128 bits of randomness
    return  __rndVal(randomness, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF, offset, length);
  }

  /**
   * @dev Generates random value based on keccak256 hash of
   *      * block.difficulty,
   *      * block.number,
   *      * gasleft(),
   *      * msg.data,
   *      * msg.sender,
   *      * msg.value,
   *      * tx.gasprice,
   *      * tx.origin
   * @dev The random value generated is not cryptographically secure
   *      and may be heavily influenced by miners, but its cheap though
   * @return random value – all possible values of uint256
   */
  function __rawRandom() private constant returns (uint256) {
    // build the keccak256 hash of the transaction dependent values
    bytes32 hash = keccak256(
      block.difficulty,
      block.number,
      gasleft(),
      msg.data,
      msg.sender,
      msg.value,
      tx.gasprice,
      tx.origin
    );
    // and return the result
    return uint256(hash);
  }

}
