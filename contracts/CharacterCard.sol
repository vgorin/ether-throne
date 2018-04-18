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
    /// @dev Card ID, immutable, cannot be zero
    uint16 id;

    /// @dev Card index within an owner's collection of cards
    uint16 index;

    /// @dev Card creation time, immutable, cannot be zero
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card was created
    uint32 creationTime;

    /// @dev Initially zero, changes when ownership is transferred
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's ownership was changed
    uint32 ownershipModified;

    /// @dev Initially zero, changes when attributes are modified
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's attributes were changed
    uint32 attributesModified;

    /// @dev Initially zero, increases after each game played
    uint32 gamesPlayed;

    /// @dev Initially zero, increases after each game won
    uint32 wins;

    /// @dev Initially zero, increases after each game lost
    uint32 loses;

    /// @dev Initially zero, stores card state data,
    ///      such as is card currently in game or not,
    ///      status of the last game played, etc
    uint32 state;

    /// @dev Initialized on card creation, 4 bytes of random data
    /// @dev Used to derive card rarity type like
    ///      casual, rare, ultra rare, legendary, hologram, etc.
    uint32 rarity;

    /// @dev Initially zero, changes after each game played
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's played a game (released from a game)
    uint32 lastGamePlayed;

    /// @dev A bitmask of the card attributes, allows storing up
    ///      to 32 attributes
    /// @dev Common attributes are stored on lower bits,
    ///      while higher bits store more rare attributes
    /// @dev Is initialized with at least 3 active attributes
    ///      (three lowest bits set to 1)
    uint32 attributes;

    /// @dev Card's owner, initialized upon card creation
    address owner;
  }

  /// @notice All the emitted cards
  /// @dev Core of the Character Card as ERC721 token
  /// @dev Maps Card ID => Card Data Structure
  mapping(uint16 => Card) public cards;

  /// @dev Mapping from a card ID to an address approved to
  ///      transfer ownership rights for this card
  mapping(uint16 => address) public approvals;

  /// @dev Mapping from owner to operator approvals
  ///      card owner => approved card operator => approvals left (zero means no approval)
  mapping(address => mapping(address => uint256)) public operators;

  /// @notice Storage for a collections of cards
  /// @notice A collection of cards is an ordered list of cards,
  ///      owned by a particular address (owner)
  /// @dev A mapping from owner to a collection of his cards (IDs)
  /// @dev ERC20 compatible structure for balances can be derived
  ///      as a length of each collection in the mapping
  /// @dev ERC20 balances[owner] is equal to collections[owner].length
  mapping(address => uint16[]) public collections;

  /// @notice Total number of existing cards
  /// @dev ERC20 compatible field for totalSupply()
  uint16 public totalSupply;

  /// @notice Defines a privileged addresses with additional
  ///      permissions on the smart contract, like minting cards,
  ///      transferring on behalf and so on
  /// @dev Maps an address to the permissions bitmask (role), where each bit
  ///      represents a permissions; bitmask 0xFFFFFFFF represents all possible permissions
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

  /// @dev The number is used as unlimited approvals number
  uint256 public constant UNLIMITED_APPROVALS = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /// @dev event names are self-explanatory:
  /// @dev fired in mint()
  event Minted(uint16 indexed cardId, address indexed to);
  /// @dev fired in transfer(), transferFor()
  event Transfer(address indexed from, address indexed to, uint16 cardId);
  /// @dev fired in approve()
  event Approval(uint16 indexed cardId, address indexed approved);
  /// @dev fired in approveForAll()
  event ApprovalForAll(address indexed owner, address indexed operator, uint256 approved);

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
   *      passed as an input parameter
   */
  function balanceOf(address who) public constant returns (uint16) {
    // read the length of the `who`s collection of cards
    return uint16(collections[who].length);
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
      id: cardId,
      // card index within the owner's collection of cards
      // points to the place where the card will be placed to
      index: uint16(collections[to].length),
      creationTime: uint32(block.number),
      ownershipModified: 0,
      attributesModified: 0,
      gamesPlayed: 0,
      wins: 0,
      loses: 0,
      state: 0,
      // TODO: generate rarity
      rarity: 0,
      lastGamePlayed: 0,
      // TODO: set attributes according to rarity
      attributes: 0x1 | 0x2 | 0x4, // first 3 attributes set
      owner: to
    });

    // push newly created card's ID to the owner's collection of cards
    collections[to].push(cardId);

    // persist card to the storage
    cards[cardId] = card;

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

    // delegate call to unsafe `__transfer`
    __transfer(from, to, cardId);
  }

  /**
   * @notice A.k.a "transfer on behalf"
   * @notice Transfers ownership rights of a card defined
   *      by the `cardId` to a new owner specified by address `to`
   * @notice Allows transferring ownership rights by an trading operator
   *      on behalf of card owner. Allows building an exchange of cards.
   * @dev Transfers the ownership of a given card ID to another address
   * @dev Requires the transaction sender to be the owner, approved, or operator
   * @param from current owner of the card
   * @param to address to receive the ownership of the card
   * @param cardId ID of the card to be transferred
   */
  function transferFrom(address from, address to, uint16 cardId) public {
    // call sender gracefully - `operator`
    address operator = msg.sender;
    // find if an approved address exists for this card
    address approved = approvals[cardId];

    // we assume `from` is an owner of the card,
    // this will be explicitly checked in `__transfer`

    // fetch how much approvals left for an operator
    uint256 approvalsLeft = operators[from][operator];

    // operator must have an approval to transfer this particular card
    // or operator must be approved to transfer all the cards
    // or, if nothing satisfies, this is equal to regular transfer,
    // where `from` is basically a transaction sender and owner of the card
    if(operator == approved || approvalsLeft > 0) {
      // update operator's approvals left + emit an event
      __decreaseOperatorApprovalsLeft(from, operator);
    }
    else {
      // transaction sender doesn't have any special permissions
      // we will treat him as a card owner and sender and try to perform
      // a regular transfer, update `from` to be `operator` (transaction sender):
      from = operator;
    }

    // delegate call to unsafe `__transfer`
    __transfer(from, to, cardId);
  }

  /**
   * @notice Approves an address to transfer the given card on behalf of its owner.
   *      Can also be used to revoke an approval by setting `to` address to zero.
   * @dev The zero `to` address revokes an approval for a given card.
   * @dev There can only be one approved address per card at a given time.
   * @dev This function can only be called by the card owner.
   * @param to address to be approved to transfer the card on behalf of its owner
   * @param cardId ID of the card to be approved for transfer on behalf
   */
  function approve(address to, uint16 cardId) public {
    // call sender nicely - `from`
    address from = msg.sender;
    // get card owner address (also ensures that card exists)
    address owner = ownerOf(cardId);

    // caller must own this card
    require(from == owner);
    // approval for owner himself is pointless, do not allow
    require(to != owner);
    // either we're removing approval, or setting it
    require(approvals[cardId] != 0 || to != address(0));

    // set an approval (deletes an approval if to == 0)
    approvals[cardId] = to;

    // emit en event
    Approval(cardId, to);
  }

  /**
   * @notice Removes an approved address, which was previously added by `approve`
   *      for the given card. Equivalent to calling approve(0, cardId)
   * @dev Same as calling approve(0, cardId)
   * @param cardId ID of the card to be remove approved address for
   */
  function revokeApproval(uint16 cardId) public {
    // delegate call to approve
    approve(address(0), cardId);
  }

  /**
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer *all* cards of the sender on their behalf
   * @param to operator address to set the approval
   * @param approved representing the status of the approval to be set
   */
  function approveForAll(address to, bool approved) public {
    // set maximum possible approval, 2^256 – 1, unlimited de facto
    approveForAll(to, approved ? UNLIMITED_APPROVALS : 0);
  }

  /**
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer *all* cards of the sender on their behalf
   * @param to operator address to set the approval
   * @param approved representing the number of approvals left to be set
   */
  function approveForAll(address to, uint256 approved) public {
    // call sender nicely - `from`
    address from = msg.sender;

    // approval for owner himself is pointless, do not allow
    require(to != from);

    // set an approval
    operators[from][to] = approved;

    // emit an event
    ApprovalForAll(from, to, approved);
  }

  /// @notice Checks if transaction sender `msg.sender` has all the required permissions `roleRequired`
  function isSenderInRole(uint32 roleRequired) public constant returns(bool) {
    // call sender gracefully - `user`
    address user = msg.sender;

    // delegate call to isUserInRole
    return isUserInRole(user, roleRequired);
  }

  /// @notice Checks if `user` has all the required permissions `rolesRequired`
  function isUserInRole(address user, uint32 roleRequired) public constant returns(bool) {
    // read user's permissions (role)
    uint32 userRole = userRoles[user];

    // delegate call to hasRole
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

  /// @dev Performs a transfer of a card `cardId` from address `from` to address `to`
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call
  ///      checks only for card existence and that ownership belongs to `from`
  /// @dev Is save to call from `transfer(to, cardId)` since it doesn't need any additional checks
  /// @dev Must be kept private at all times
  function __transfer(address from, address to, uint16 cardId) private {
    // validate source and destination address
    require(from != address(0));
    require(to != address(0));
    require(to != from);

    // get the card from the storage
    Card memory card = cards[cardId]; // TODO: check if modifying a card in the storage is cheaper

    // get card's owner address
    address owner = card.owner;

    // validate card existence
    require(owner != address(0));
    // validate card ownership
    require(owner == from);

    // TODO: check if a card is not locked (for example in game)

    // clear approved address for this particular card + emit event
    __clearApprovalFor(cardId);

    // move card ownership,
    // update old and new owner's card collections accordingly
    __move(from, to, card);

    // persist card back into the storage
    cards[cardId] = card;

    // fire an event
    Transfer(from, to, cardId);
  }

  /// @dev Clears approved address for a particular card
  function __clearApprovalFor(uint16 cardId) private {
    // check if approval exists - we don't want to fire an event in vain
    if(approvals[cardId] != address(0)) {
      // clear approval
      delete approvals[cardId];

      // emit event
      Approval(cardId, address(0));
    }
  }

  /// @dev Decreases operator's approvals left
  function __decreaseOperatorApprovalsLeft(address owner, address operator) private {
    // read how much approvals this operator has
    uint256 approvalsLeft = operators[owner][operator];

    // check if approvals exist – we don't want to fire an event in vain
    if (approvalsLeft > 0) {
      // update approvals left
      operators[owner][operator] = --approvalsLeft;

      // emit an event
      ApprovalForAll(owner, operator, approvalsLeft);
    }
  }

  /// @dev Move a `card` from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __move(address from, address to, Card card) private {
    // get a reference to the collection where card is now
    uint16[] storage f = collections[from];

    // get a reference to the collection where card goes to
    uint16[] storage t = collections[to];

    // collection `f` cannot be empty, if it is - it's a bug
    assert(f.length > 0);

    // index of the card within collection `f`
    uint16 i = card.index;

    // we put the last card in the collection `f` to the position released
    // get an ID of the last card in `f`
    uint16 cardId = f[f.length - 1];

    // update card index to point to proper place in the collection `f`
    cards[cardId].index = i;

    // put it into the position i within `f`
    f[i] = cardId;

    // trim the collection `f` by removing last element
    f.length--;

    // update card index according to position in new collection `t`
    card.index = uint16(t.length);

    // update card owner
    card.owner = to;

    // update ownership transfer date
    card.ownershipModified = uint32(block.number);

    // push card into collection
    t.push(card.id);
  }
}
