pragma solidity 0.4.18;

/**
 * @notice Character card is unique tradable entity. Non-fungible.
 * @dev Card is an ERC721 non-fungible token, which maps Card ID,
 * a number in range 1..5000 to a set of card properties -
 * attributes (mostly immutable by their nature) and state variables (mutable)
 * @dev A card supports minting but not burning, a card cannot be destroyed
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
  /// @dev Maps Card ID => Card Data Structure
  mapping(uint16 => Card) public cards;

  /// @notice Total number of cards owned by each account
  /// @dev ERC20 compatible structure for balances
  mapping(address => uint16) private balances;

  /// @notice Total number of existing cards
  /// @dev ERC20 compatible field for totalSupply()
  uint16 public totalSupply;

  /// @notice Defines a privileged addresses with additional
  /// permissions on the smart contract, like minting cards,
  /// transferring on behalf and so on
  /// @dev Maps an address to the permissions bitmask (role), where each bit
  /// represents a permissions; bitmask 0xFFFFFFFF represents all possible permissions
  mapping(address => uint32) public userRoles;

  /// @notice Card creator is responsible for creating cards
  /// @dev Role ROLE_CARD_CREATOR allows minting cards
  uint32 public constant ROLE_CARD_CREATOR = 0x00000001;

  /// @notice Card game provider is responsible for enabling the game protocol
  /// @dev Role ROLE_COMBAT_PROVIDER allows modifying gamesPlayed,
  /// wins, loses, state, lastGamePlayed, attributes
  uint32 public constant ROLE_COMBAT_PROVIDER = 0x00000002;

  /// @notice Exchange is responsible for trading cards on behalf of card holders
  /// @dev Role ROLE_EXCHANGE allows executing transfer on behalf of card holders
  uint32 public constant ROLE_EXCHANGE = 0x00000004;

  /// @notice Role manager is responsible for assigning the roles
  /// @dev Role ROLE_ROLE_MANAGER allows executing addOperator/removeOperator
  uint32 public constant ROLE_ROLE_MANAGER = 0x00000008;

  /// @dev Bitmask represents all the possible permissions (super admin role)
  uint32 public constant FULL_PRIVILEGES_MASK = 0xFFFFFFFF;

  /// @dev event names are self-explanatory:
  /// @dev fired in mint()
  event Minted(uint16 indexed cardId, address indexed to);
  /// @dev fired in transfer()
  event Transfer(address indexed from, address indexed to, uint16 cardId);

  /// @dev Creates a card as a ERC721 token
  function CharacterCard() public {
    // call sender gracefully - contract `creator`
    address creator = msg.sender;

    // creator has full privileges
    userRoles[creator] = FULL_PRIVILEGES_MASK;
  }

  /**
   * @dev Adds a new `operator` - an address which has
   *      some extended privileges over the character card smart contract,
   *      for example card minting, transferring on behalf, etc.
   * @dev Newly added `operator` cannot have any permissions which
   *      transaction sender doesn't have.
   * @dev Requires transaction sender to have `ROLE_ROLE_MANAGER` permission.
   * @dev Cannot update existing operator. Throws if `operator` already exists.
   * @param operator address of the operator to add
   * @param role bitmask representing a set of permissions which
   *      newly created operator will have
   */
  function addOperator(address operator, uint32 role) public {
    // call sender gracefully - `manager`
    address manager = msg.sender;

    // read manager's permissions (role)
    uint32 p = userRoles[manager];

    // check that `operator` doesn't exist
    require(userRoles[operator] == 0);

    // manager must have a ROLE_ROLE_MANAGER role
    require(hasRole(p, ROLE_ROLE_MANAGER));

    // recalculate permissions (role) to set:
    // we cannot create an operator more powerful then calling `manager`
    role &= p;

    // check if we still have some permissions (role) to set
    require(role != 0);

    // create an operator by persisting his permissions (roles) to storage
    userRoles[operator] = role;
  }

  /**
   * @dev Deletes an existing `operator`.
   * @dev Requires sender to have `ROLE_ROLE_MANAGER` permission.
   * @param operator address of the operator to delete
   */
  function removeOperator(address operator) public {
    // check if an `operator` exists
    require(userRoles[operator] != 0);

    // check if caller has ROLE_ROLE_MANAGER
    require(isSenderInRole(ROLE_ROLE_MANAGER));

    // TODO: do we need to check if we're removing last operator and leaving smart contract without operators at all

    // perform operator deletion
    delete userRoles[operator];
  }

  /**
   * @dev Updates an existing `operator`, adding a specified role to it.
   * @dev Note that `operator` cannot receive permission which
   *      transaction sender doesn't have.
   * @dev Requires transaction sender to have `ROLE_ROLE_MANAGER` permission.
   * @dev Cannot create a new operator. Throws if `operator` doesn't exist.
   * @dev Existing permissions of the `operator` are preserved
   * @param operator address of the operator to update
   * @param role bitmask representing a set of permissions which
   *      `operator` will have
   */
  function addRole(address operator, uint32 role) public {
    // call sender gracefully - `manager`
    address manager = msg.sender;

    // read manager's permissions (role)
    uint32 p = userRoles[manager];

    // check that `operator` exists
    require(userRoles[operator] != 0);

    // manager must have a ROLE_ROLE_MANAGER role
    require(hasRole(p, ROLE_ROLE_MANAGER));

    // recalculate permissions (role) to add:
    // we cannot make an operator more powerful then calling `manager`
    role &= p;

    // check if we still have some permissions (role) to add
    require(role != 0);

    // update operator's permissions (roles) in the storage
    userRoles[operator] |= role;
  }

  /**
   * @dev Updates an existing `operator`, removing a specified role from it.
   * @dev Note that  permissions which transaction sender doesn't have
   *      cannot be removed.
   * @dev Requires transaction sender to have `ROLE_ROLE_MANAGER` permission.
   * @dev Cannot remove all permissions. Throws on such an attempt.
   * @param operator address of the operator to update
   * @param role bitmask representing a set of permissions which
   *      will be removed from the `operator`
   */
  function removeRole(address operator, uint32 role) public {
    // call sender gracefully - `manager`
    address manager = msg.sender;

    // read manager's permissions (role)
    uint32 p = userRoles[manager];

    // check that we're not removing all the `operator`s permissions
    require(userRoles[operator] ^ role != 0);

    // manager must have a ROLE_ROLE_MANAGER role
    require(hasRole(p, ROLE_ROLE_MANAGER));

    // recalculate permissions (role) to remove:
    // we cannot revoke permissions which calling `manager` doesn't have
    role &= p;

    // check if we still have some permissions (role) to revoke
    require(role != 0);

    // update operator's permissions (roles) in the storage
    userRoles[operator] &= FULL_PRIVILEGES_MASK ^ role;
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
   *      assigns to an address `to` an ownership of that card.
   * @param cardId ID of the card to create
   * @param to an address to assign created card ownership to
   */
  function mint(uint16 cardId, address to) public {
    // check if caller has sufficient permissions to mint a card
    require(isSenderInRole(ROLE_CARD_CREATOR));

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
   *      by the `cardId` to a new owner specified by address `to`
   * @dev Requires the sender of the transaction to be an owner
   *      of the card specified (`cardId`)
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
    // TODO: check if modifying a card in the storage is cheaper
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

  /// @notice Checks if transaction sender `msg.sender` has all the required permissions `roleRequired`
  function isSenderInRole(uint32 roleRequired) public constant returns(bool) {
    // call sender gracefully - `user`
    address user = msg.sender;

    // delegate call to __isUserInRole
    return isUserInRole(user, roleRequired);
  }

  /// @notice Checks if `user` has all the required permissions `rolesRequired`
  function isUserInRole(address user, uint32 roleRequired) public constant returns(bool) {
    // read user's permissions (role)
    uint32 userRole = userRoles[user];

    // delegate call to __hasRole
    return hasRole(userRole, roleRequired);
  }

  /// @notice Checks if user role `userRole` contain all the permissions required `roleRequired`
  function hasRole(uint32 userRole, uint32 roleRequired) public pure returns(bool) {
    // check the bitmask for the role required and return the result
    return userRole & roleRequired == roleRequired;
  }

  /// @notice Checks if `user` has at least one special permission on the contract
  function isOperator(address user) public constant returns(bool) {
    // read `user` address role and check if its not zero
    return userRoles[user] != 0;
  }

}
