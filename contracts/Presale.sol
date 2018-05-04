pragma solidity 0.4.23;

import "./CharacterCard.sol";

/**
 * @notice A crowdsale-like smart contract, responsible for selling
 *      character cards (`CharacterCard` ERC721 non-fungible tokens)
 * @dev Referenced as "card sale smart contract" below
 */
contract Presale {
  /// @dev Version of the CharacterCard smart contract to work with
  /// @dev See `CharacterCard.version`/`CharacterCard.version()`
  uint32 public CHAR_CARD_VERSION_REQUIRED = 0x4;

  /// @dev ID of the first card to sell
  uint16 public constant OFFSET = 1;

  /// @dev Number of cards to sell during the card sale
  /// @dev Last card ID to sell is OFFSET + LENGTH - 1
  uint16 public constant LENGTH = 4000;

  /// @dev Price of the first card to sell (initial price of the card)
  /// @dev Next cards' price may differ, it can be a function of cards sold,
  ///      number of cards sold in a single transaction and so on.
  ///      This behaviour is defined in the `nextPrice()` function
  uint256 public constant INITIAL_PRICE = 50 finney;

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
  event PurchaseComplete(address indexed from, address indexed to, uint8 amount);

  /**
   * @dev Creates a card sale smart contract instance
   * @param tokenAddress address of the deployed CharacterCard ERC721 token instance,
   *      used to mint card instances (delegates a call to `CharacterCard.mint function`)
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
    // validate ERC20-compatible symbol
    require(keccak256("ET") == keccak256(cardInstance.symbol()));
    // validate smart contract version
    require(CHAR_CARD_VERSION_REQUIRED == cardInstance.version());

    // setup all the parameters left
    beneficiary = _beneficiary;
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
  function buy() public payable {
    // just delegate call to `buyFor`
    buyFor(msg.sender);
  }

  /// @dev Accepts a payment and sends card(s) to the player
  function buyFor(address to) public payable {
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

    // get some randomness to init card rarity data
    // this randomness is not cryptographically secure of course
    // and may be heavily influenced by miners, but its cheap though
    uint256 randomness = uint256(keccak256(block.number, gasleft(), tx.origin, msg.sender, to, valueReceived));

    // total price of the cards to send
    uint256 totalPrice = single;

    // if the value received is not enough to buy three cards
    // (33% discount) or we don't have three cards to sell left
    // we sell only one card, otherwise we sell three cards
    if(valueReceived < triple || LENGTH - sold < 3) {
      // mint a card with the next ID in series [OFFSET, OFFSET + LENGTH)
      // update sold cards counter accordingly
      // use low 32 bits of generated randomness to init card rarity data
      cardInstance.mintWith(to, OFFSET + sold++, uint32(randomness), 0x00000007);
    }
    else {
      // update total price of the three cards to sell
      totalPrice = triple;
      // mint three cards with the next IDs in series [OFFSET, OFFSET + LENGTH)
      // update sold cards counter accordingly
      // use low 96 bits of generated randomness to init cards rarity data
      cardInstance.mintCards(
        to,
        __pack3Cards(
          OFFSET + sold++, uint32(randomness >> 64), 0x00000007,
          OFFSET + sold++, uint32(randomness >> 32), 0x00000007,
          OFFSET + sold++, uint32(randomness), 0x00000007
        )
      );
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

  /// @dev Packs 3 cards into an uint64[3] dynamic array
  function __pack3Cards(
    uint16 id1, uint32 r1, uint16 a1, uint16 id2, uint32 r2, uint16 a2, uint16 id3, uint32 r3, uint16 a3
  ) private pure returns (uint64[]) {
    uint64[] memory data = new uint64[](3);
    data[0] = __pack64(id1, r1, a1);
    data[1] = __pack64(id2, r2, a2);
    data[2] = __pack64(id3, r3, a3);
    return data;
  }

  /// @dev Packs single card into uint64
  function __pack64(uint16 cardId, uint32 rarity, uint16 attributes) private pure returns (uint64) {
    // cardId (16 bits) | rarity (32 bits) | attributes (low 16 bits)
    return uint64(cardId) << 48 | uint48(rarity) << 16 | attributes;
  }

}
