pragma solidity 0.4.18;

/**
 * @notice Character card is unique tradable entity. Non-fungible.
 * @dev Card is an ERC721 non-fungible token, which maps Card ID,
 * a number in range 1..5000 to a set of card properties -
 * attributes (mostly immutable by their nature) and state variables (mutable)
 */
contract CharacterCard {

  /// @dev A character card data structure
  /// @dev Occupies 64 bytes of storage (512 bits)
  struct Card {
    /// @dev Card creation time, immutable, cannot be zero
    /// @dev Stored as Ethereum Block Number of the transaction
    /// when the card was created
    uint32 creationTime;

    /// @dev Initially zero, changes when ownership is transferred
    /// @dev Stored as Ethereum Block Number of the transaction
    /// when the card's ownership was changed
    uint32 ownershipModified;

    /// @dev Initially zero, changes when attributes are modified
    /// @dev Stored as Ethereum Block Number of the transaction
    /// when the card's attributes were changed
    uint32 attributesModified;

    /// @dev Initially zero, increases after each game played
    uint32 gamesPlayed;

    /// @dev Initially zero, increases after each game won
    uint32 wins;

    /// @dev Initially zero, increases after each game lost
    uint32 loses;

    /// @dev Initially zero, stores card state data,
    /// such as is card currently in game or not,
    /// status of the last game played, etc
    uint32 state;

    /// @dev Initialized on card creation, 4 bytes of random data
    /// @dev Used to derive card rarity type like
    /// casual, rare, ultra rare, legendary, hologram, etc.
    uint32 rarity;

    /// @dev Initially zero, changes after each game played
    /// @dev Stored as Ethereum Block Number of the transaction
    /// when the card's played a game (released from a game)
    uint32 lastGamePlayed;

    /// @dev A bitmask of the card attributes, allows storing up
    /// to 64 attributes
    /// @dev Common attributes are stored on lower bits,
    /// while higher bits store more rare attributes
    /// @dev Is initialized with at least 3 active attributes
    /// (three lowest bits set to 1)
    uint64 attributes;

    /// @dev Card's owner, initialized upon card creation
    address owner;
  }

  /// @notice All the emitted cards
  /// @dev Core of the Character Card as ERC721 token
  /// @dev maps Card ID => Card Data Structure
  mapping(uint16 => Card) public cards;

  /// @notice Total number of cards owned by each account
  /// @dev ERC20 compatible structure for balances
  mapping(address => uint16) private balances;

  /// @notice Total number of existing cards
  /// @dev ERC20 compatible field for totalSupply()
  uint16 public totalSupply;

  /// @dev event names are self-explanatory:
  /// @dev fired in mint()
  event Minted(uint16 indexed cardId, address indexed to);
  /// @dev fired in burn()
  event Burnt(uint16 indexed cardId, address indexed from);
  /// @dev fired in transfer()
  event Transfer(address indexed from, address indexed to, uint16 cardId);

  /// @dev Creates a card as a ERC721 token
  function CharacterCard() public {

  }

  /**
   * @notice Gets an amount of cards owned by the given address
   * @dev Gets the balance of the specified address
   * @param who address to query the balance for
   * @return uint16 representing the amount owned by the address
   * passed as an input parameter
   */
  function balanceOf(address who) public constant returns (uint16) {
    // simply read the balance from balances
    return balances[who];
  }

  /**
   * @notice Checks if specified card exists
   * @dev Returns whether the specified token ID exists
   * @param cardId ID of the card to query the existence for
   * @return whether the card exists (true - exists)
   */
  function exists(uint16 cardId) public constant returns (bool) {
    // get the card's owner address from storage
    address owner = cards[cardId].owner;

    // check if this card exists (owner is not zero)
    return owner != address(0);
  }

  /**
   * @notice finds an owner address for a card specified
   * @dev Gets the owner of the specified card from the cards mapping
   * @dev Throws if a card with the ID specified doesn't exist
   * @param cardId ID of the card to query the owner for
   * @return owner address currently marked as the owner of the given card
   */
  function ownerOf(uint16 cardId) public constant returns (address) {
    // get the card's owner address from storage
    address owner = cards[cardId].owner;

    // check if this card exists (owner is not zero)
    require(owner != address(0));

    // return owner's address
    return owner;
  }

  /**
   * @dev Creates new card with `cardId` ID specified and
   * assigns to an address `to` an ownership of that card.
   * @param cardId ID of the card to create
   * @param to an address to assign created card ownership to
   */
  function mint(uint16 cardId, address to) public {
    // TODO: check that sender has permissions to mint a card
    // validate destination address
    require(to != address(0));

    // check if card doesn't exist
    require(!exists(cardId));

    // create a new card in memory
    Card memory card = Card({
      creationTime: uint32(block.number),
      ownershipModified: 0,
      attributesModified: 0,
      gamesPlayed: 0,
      wins: 0,
      loses: 0,
      state: 0,
      rarity: 0, // TODO: generate rarity
      lastGamePlayed: 0,
      attributes: 0, // TODO: set attributes according to rarity
      owner: to
    });

    // persist card to the storage
    cards[cardId] = card;

    // update new owner balance
    balances[to]++;

    // update total supply
    totalSupply++;

    // fire an event
    Minted(cardId, to);
  }

  /**
   * @notice Transfers ownership rights of a card defined
   * by the `cardId` to a new owner specified by address `to`
   * @dev Requires the sender of the transaction to be an owner
   * of the card specified (`cardId`)
   * @param to new owner address
   * @param cardId ID of the card to transfer ownership rights for
   */
  function transfer(address to, uint16 cardId) public {
    // call sender gracefully - `from`
    address from = msg.sender;

    // validate destination address
    require(to != address(0));
    require(to != from);

    // get the card from the storage
    // TODO: check if modifying card in the storage is cheaper
    Card memory card = cards[cardId];

    // validate card ownership (and existence)
    require(card.owner == from);

    // update ownership modified time
    card.ownershipModified = uint32(block.number);
    // update ownership itself
    card.owner = to;

    // persist card back into the storage
    cards[cardId] = card;

    // update new and old owner balances
    balances[from]--;
    balances[to]++;

    // fire an event
    Transfer(from, to, cardId);
  }
}
