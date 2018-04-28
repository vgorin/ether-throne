pragma solidity 0.4.23;

/**
 * @notice Character card is unique tradable entity. Non-fungible.
 * @dev Card is an ERC721 non-fungible token, which maps Card ID,
 * a number in range 1..5000 to a set of card properties -
 * attributes (mostly immutable by their nature) and state variables (mutable)
 * @dev A card supports minting but not burning, a card cannot be destroyed
 */
contract CharacterCard {
  /// @dev ERC20 compatible token symbol
  string public constant symbol = "ET";
  /// @dev ERC20 compatible token name
  string public constant name = "Character Card - Ether Throne";
  /// @dev ERC20 compatible token decimals
  /// @dev this can be only zero, since ERC721 token is non-fungible
  uint8 public constant decimals = 0;

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
    uint32 losses;

    /// @dev Initially zero, stores card state data,
    ///      such as is card currently in game or not,
    ///      status of the last game played, etc
    uint32 state;

    /// @dev Initialized on card creation, immutable
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

  /// @notice Defines a privileged addresses with additional
  ///      permissions on the smart contract, like minting cards,
  ///      transferring on behalf and so on
  /// @dev Maps an address to the permissions bitmask (role), where each bit
  ///      represents a permissions; bitmask 0xFFFFFFFF represents all possible permissions
  mapping(address => uint32) public userRoles;

  /// @notice Total number of existing cards
  /// @dev ERC20 compatible field for totalSupply()
  uint16 public totalSupply;

  /// @dev The data in card's state may contain lock(s)
  ///      (ex.: is card currently in the game or not)
  /// @dev A locked card cannot be transferred
  /// @dev The card is locked if it contains any bits
  ///      from the `lockedBitmask` in its `state` set
  uint32 public lockedBitmask = DEFAULT_IN_GAME_BIT;

  /// @dev Default bitmask indicating that the card is `in game`
  /// @dev Consists of a single bit at position 3 – binary 100
  /// @dev This bit is cleared by `battleComplete`
  /// @dev First 2 lower bits are used by the last game status outcome data:
  ///      0: undefined
  ///      1: defeat
  ///      2: draw
  ///      3: victory
  uint8 public constant DEFAULT_IN_GAME_BIT = 0x4; // bit number 3
  /// @dev Bits 1-2 mask, used to read/write game outcome data
  uint8 public constant LAST_GAME_OUTCOME_BITS = 0x3; // bits 1-2
  /// @dev Bits 1-3 mask, used in battleComplete to clear game outcome and card state
  uint8 public constant BATTLE_COMPLETE_CLEAR_BITS = 0x7; // bits 1-3: outcome + in game
  /// @dev Constant indicating no game outcome (card never played a game)
  uint8 public constant GAME_OUTCOME_UNDEFINED = 0;
  /// @dev Constant indicating the defeat of a card (victory of an opponent card)
  uint8 public constant GAME_OUTCOME_DEFEAT = 1;
  /// @dev Constant indicating the draw
  uint8 public constant GAME_OUTCOME_DRAW = 2;
  /// @dev Constant indicating victory of a card (defeat of an opponent card)
  uint8 public constant GAME_OUTCOME_VICTORY = 3;

  /// @notice Card creator is responsible for creating cards
  /// @dev Role ROLE_CARD_CREATOR allows minting cards
  uint32 public constant ROLE_CARD_CREATOR = 0x00000001;

  /// @notice Card game provider is responsible for enabling the game protocol
  /// @dev Role ROLE_COMBAT_PROVIDER allows modifying gamesPlayed,
  ///      wins, losses, state, lastGamePlayed, attributes
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

  /// @dev Event names are self-explanatory:
  /// @dev Fired in mint()
  /// @dev Address `from` allows to track who created a card
  event Minted(uint16 indexed cardId, address indexed to, address from);
  /// @dev Fired in transfer(), transferFor(), mint()
  /// @dev When minting a card, address `from` is zero
  event Transfer(address indexed from, address indexed to, uint16 cardId);
  /// @dev Fired in approve()
  event Approval(uint16 indexed cardId, address indexed approved);
  /// @dev Fired in approveForAll()
  event ApprovalForAll(address indexed owner, address indexed operator, uint256 approved);
  /// @dev Fired in battlesComplete(), battleComplete()
  event BattleComplete(
    uint16 indexed card1Id,
    uint16 indexed card2Id,
    uint32 wins,          // card1 wins = card2 losses
    uint32 losses,        // card1 losses = card2 wins
    uint32 gamesPlayed,   // card1 games played = card2 games played
    uint8 lastGameOutcome // card1 last game outcome = 4 - card2 last game outcome
  );

  /// @dev Creates a card as a ERC721 token
  constructor() public {
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
    uint32 r = role & p;

    // check if we still have some permissions (role) to set
    require(r != 0);

    // create an operator by persisting his permissions (roles) to storage
    userRoles[operator] = r;
  }

  /**
   * @dev Deletes an existing `operator`.
   * @dev Requires sender to have `ROLE_ROLE_MANAGER` permission.
   * @param operator address of the operator to delete
   */
  function removeOperator(address operator) public {
    // check if an `operator` exists
    require(userRoles[operator] != 0);

    // do not allow transaction sender to remove himself
    // protects from an accidental removal of all the operators
    require(operator != msg.sender);

    // check if caller has ROLE_ROLE_MANAGER
    require(isSenderInRole(ROLE_ROLE_MANAGER));

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
    uint32 r = role & p;

    // check if we still have some permissions (role) to add
    require(r != 0);

    // update operator's permissions (roles) in the storage
    userRoles[operator] |= r;
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
    uint32 r = role & p;

    // check if we still have some permissions (role) to revoke
    require(r != 0);

    // update operator's permissions (roles) in the storage
    userRoles[operator] &= FULL_PRIVILEGES_MASK ^ r;
  }

  /**
   * @dev Gets a card by ID, representing it as two integers.
   *      The two integers are tightly packed with a card data:
   *      First integer (high bits) contains (from higher to lower bits order):
   *          id,
   *          index,
   *          creationTime,
   *          ownershipModified,
   *          attributesModified,
   *          gamesPlayed,
   *          wins,
   *          losses,
   *          state
   *      Second integer (low bits) contains (from higher to lower bits order):
   *          rarity,
   *          lastGamePlayed,
   *          attributes,
   *          owner
   * @dev Throws if card doesn't exist
   */
  function getCard(uint16 cardId) public constant returns(uint256, uint256) {
    // load the card from storage
    Card memory card = cards[cardId];

    // get the card's owner address
    address owner = card.owner;

    // validate card existence
    require(owner != address(0));

    // pack high 256 bits of the result
    uint256 high = uint256(card.id) << 240
                 | uint240(card.index) << 224
                 | uint224(card.creationTime) << 192
                 | uint192(card.ownershipModified) << 160
                 | uint160(card.attributesModified) << 128
                 | uint128(card.gamesPlayed) << 96
                 | uint96(card.wins) << 64
                 | uint64(card.losses) << 32
                 | uint32(card.state);

    // pack low 256 bits of the result
    uint256 low = uint256(card.rarity) << 224
                | uint224(card.lastGamePlayed) << 192
                | uint192(card.attributes) << 160
                | uint160(card.owner);

    // return the whole 512 bits of result
    return (high, low);
  }

  /**
   * @dev Allows setting the `lockedBitmask` parameter of the contract,
   *      which is used to determine if a particular card is locked or not
   * @dev A locked card cannot be transferred
   * @dev The card is locked if it contains any bits
   *      from the `lockedBitmask` in its `state` set
   */
  function setLockedBitmask(uint32 bitmask) public {
    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // update the locked bitmask
    lockedBitmask = bitmask;
  }

  /**
   * @dev Gets the state of a card
   * @param cardId ID of the card to get state for
   * @return a card state
   */
  function getState(uint16 cardId) public constant returns(uint32) {
    // get the card from storage
    Card memory card = cards[cardId];

    // validate card existence
    require(card.owner != address(0));

    // obtain card's state and return
    return card.state;
  }

  /**
   * @dev Sets the state of a card
   * @param cardId ID of the card to set state for
   * @param state new state to set for the card
   */
  function setState(uint16 cardId, uint32 state) public {
    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[cardId];

    // check that card to set attributes for exists
    require(card.owner != address(0));

    // set the state required
    card.state = state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[cardId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev A mechanism to update two cards which were engaged in a battle
   * @param card1Id first card's ID engaged in a battle
   * @param card2Id second card's ID engaged in a battle
   * @param outcome game outcome,
   *      1 means that first card lost and second card won,
   *      2 means draw,
   *      3 means that first card won and second card lost
   */
  function battleComplete(uint16 card1Id, uint16 card2Id, uint8 outcome) public {
    // the check if outcome is one of [1, 2, 3] is done in
    // a call to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`

    // prepare wins/losses variables to delegate call
    // to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`
    uint32 wins = outcome == GAME_OUTCOME_VICTORY? 1: 0;
    uint32 losses = outcome == GAME_OUTCOME_DEFEAT? 1: 0;

    // delegate call to `battleComplete(uint16, uint16, uint32, uint32, uint32, uint8)`
    battleComplete(card1Id, card2Id, wins, losses, 1, outcome);
  }

  /**
   * @dev A mechanism to update two cards which were engaged in a battle
   * @dev Same as `battleComplete(uint16, uint16, outcome)` but allows for a batch update
   * @param card1Id first card's ID engaged in a battle
   * @param card2Id second card's ID engaged in a battle
   * @param wins number of times 1st card won (2nd lost)
   * @param losses number of times 1st card lost (2nd won)
   * @param gamesPlayed total games played, cannot exceed wins + losses, cannot be zero
   */
  function battleComplete(
    uint16 card1Id,
    uint16 card2Id,
    uint32 wins,
    uint32 losses,
    uint32 gamesPlayed,
    uint8 lastGameOutcome
  ) public {
    // arithmetic overflow check
    require(wins <= wins + losses);
    // first check is enough, symmetric situation is impossible
    assert(losses <= wins + losses);

    // input data sanity check
    require(gamesPlayed != 0);
    require(wins + losses <= gamesPlayed);

    // check if last game outcome is one of [1, 2, 3]
    // check if it is consistent with wins/losses counters
    require(lastGameOutcome == GAME_OUTCOME_DEFEAT && losses != 0   // defeat means losses cannot be zero
         || lastGameOutcome == GAME_OUTCOME_DRAW && wins + losses < gamesPlayed
         || lastGameOutcome == GAME_OUTCOME_VICTORY && wins != 0); // victory means wins cannot be zero

    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get cards from the storage
    Card storage card1 = cards[card1Id];
    Card storage card2 = cards[card2Id];

    // check if both card exist
    require(card1.owner != address(0));
    require(card2.owner != address(0));

    // check if two cards have different owners
    require(card1.owner != card2.owner);

    // arithmetic overflow checks before updating cards
    require(card1.gamesPlayed + gamesPlayed > card1.gamesPlayed);
    require(card2.gamesPlayed + gamesPlayed > card2.gamesPlayed);

    // no need to check for arithmetic overflows in wins/losses,
    // since these numbers cannot exceed gamesPlayed number
    // if these validations do not pass – it's a bug
    assert(card1.wins + wins >= card1.wins);
    assert(card1.losses + losses >= card1.losses);
    assert(card2.wins + losses >= card2.wins);
    assert(card2.losses + wins >= card2.losses);

    // update games played counters
    card1.gamesPlayed += gamesPlayed;
    card2.gamesPlayed += gamesPlayed;

    // update outcomes
    // for card1 its straight forward
    card1.wins += wins;
    card1.losses += losses;
    // for card2 its vice versa (card1 victory = card2 defeat)
    card2.wins += losses;
    card2.losses += wins;

    // update last game played timestamps
    card1.lastGamePlayed = uint32(block.number);
    card2.lastGamePlayed = uint32(block.number);

    // update last game played statuses (outcomes),
    // clear 'in game' bit for both cards – move cards out of game
    card1.state = card1.state & (0xFFFFFFFF ^ BATTLE_COMPLETE_CLEAR_BITS) | lastGameOutcome;
    card2.state = card2.state & (0xFFFFFFFF ^ BATTLE_COMPLETE_CLEAR_BITS) | (4 - lastGameOutcome);

    // persist cards back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[card1Id] = card1; // uncomment if card is in memory (will increase gas usage!)
    //cards[card2Id] = card2; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit BattleComplete(card1Id, card2Id, wins, losses, gamesPlayed, lastGameOutcome);
  }

  /**
   * @dev Gets attributes of a card
   * @param cardId ID of the card to get attributes for
   * @return a card attributes bitmask
   */
  function getAttributes(uint16 cardId) public constant returns(uint32) {
    // get the card from storage
    Card memory card = cards[cardId];

    // validate card existence
    require(card.owner != address(0));

    // read the attributes and return
    return card.attributes;
  }

  /**
   * @dev Sets attributes of a card
   * @dev Erases all previously set attributes
   * @param cardId ID of the card to set attributes for
   * @param attributes bitmask representing card attributes to set
   */
  function setAttributes(uint16 cardId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[cardId];

    // check that card to set attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // set the attributes required
    card.attributes = attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[cardId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Adds attributes to a card
   * @dev Preserves all previously set attributes
   * @param cardId ID of the card to add attributes to
   * @param attributes bitmask representing card attributes to add
   */
  function addAttributes(uint16 cardId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[cardId];

    // check that card to add attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // add the attributes required
    card.attributes |= attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[cardId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Removes attributes from a card
   * @dev Preserves all the attributes which are not specified by `attributes`
   * @param cardId ID of the card to remove attributes from
   * @param attributes bitmask representing card attributes to remove
   */
  function removeAttributes(uint16 cardId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[cardId];

    // check that card to remove attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // add the attributes required
    card.attributes &= 0xFFFFFFFF ^ attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[cardId] = card; // uncomment if card is in memory (will increase gas usage!)
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
    // delegate call to `mintWith`
    mintWith(cardId, to, 0, 0, 0);
  }

  /**
   * @dev Creates new card with `cardId` ID specified and
   *      assigns an ownership `to` for that card.
   * @dev Allows setting card's state, rarity and attributes.
   * @param cardId ID of the card to create
   * @param to an address to assign created card ownership to
   * @param state an integer, representing card's state
   * @param rarity an integer, representing card's rarity
   * @param attributes a bitmask of the card attributes
   */
  function mintWith(uint16 cardId, address to, uint32 state, uint32 rarity, uint32 attributes) public {
    // call sender nicely - `from`
    address from = msg.sender;

    // check if caller has sufficient permissions to mint a card
    require(isUserInRole(from, ROLE_CARD_CREATOR));

    // validate destination address
    require(to != address(0));

    // validate card ID is not zero
    require(cardId != 0);

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
      losses: 0,
      state: state,
      rarity: rarity,
      lastGamePlayed: 0,
      attributes: attributes,
      owner: to
    });

    // push newly created card's ID to the owner's collection of cards
    collections[to].push(cardId);

    // persist card to the storage
    cards[cardId] = card;

    // update total supply
    totalSupply++;

    // fire a Mint event
    emit Minted(cardId, to, from);
    // fire Transfer event (ERC20 compatibility)
    emit Transfer(address(0), to, cardId);
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
    if(operator == approved || approvalsLeft != 0) {
      // update operator's approvals left + emit an event
      __decreaseOperatorApprovalsLeft(from, operator);
    }
    else {
      // transaction sender doesn't have any special permissions
      // we will treat him as a card owner and sender and try to perform
      // a regular transfer, check `from` to be `operator` (transaction sender):
      require(from == operator);
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
    require(approvals[cardId] != address(0) || to != address(0));

    // set an approval (deletes an approval if to == 0)
    approvals[cardId] = to;

    // emit en event
    emit Approval(cardId, to);
  }

  /**
   * @notice Removes an approved address, which was previously added by `approve`
   *      for the given card. Equivalent to calling approve(0, cardId)
   * @dev Same as calling approve(0, cardId)
   * @param cardId ID of the card to be remove approved address for
   */
  function revokeApproval(uint16 cardId) public {
    // delegate call to `approve`
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

    // validate destination address
    require(to != address(0));

    // approval for owner himself is pointless, do not allow
    require(to != from);

    // set an approval
    operators[from][to] = approved;

    // emit an event
    emit ApprovalForAll(from, to, approved);
  }

  /// @notice Checks if transaction sender `msg.sender` has all the required permissions `roleRequired`
  function isSenderInRole(uint32 roleRequired) public constant returns(bool) {
    // call sender gracefully - `user`
    address user = msg.sender;

    // delegate call to `isUserInRole`
    return isUserInRole(user, roleRequired);
  }

  /// @notice Checks if `user` has all the required permissions `rolesRequired`
  function isUserInRole(address user, uint32 roleRequired) public constant returns(bool) {
    // read user's permissions (role)
    uint32 userRole = userRoles[user];

    // delegate call to `hasRole`
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
    require(to != address(0));
    require(to != from);
    // impossible by design of transfer(), transferFrom(), approve() and approveForAll()
    assert(from != address(0));

    // get the card pointer to the storage
    Card storage card = cards[cardId];

    // get card's owner address
    address owner = card.owner;

    // validate card existence
    require(owner != address(0));
    // validate card ownership
    require(owner == from);

    // transfer is not allowed for a locked card
    // (ex.: if card is currently in game/battle)
    require(card.state & lockedBitmask == 0);

    // clear approved address for this particular card + emit event
    __clearApprovalFor(cardId);

    // move card ownership,
    // update old and new owner's card collections accordingly
    __move(from, to, card);

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[cardId];`
    //cards[cardId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit Transfer(from, to, cardId);
  }

  /// @dev Clears approved address for a particular card
  function __clearApprovalFor(uint16 cardId) private {
    // check if approval exists - we don't want to fire an event in vain
    if(approvals[cardId] != address(0)) {
      // clear approval
      delete approvals[cardId];

      // emit event
      emit Approval(cardId, address(0));
    }
  }

  /// @dev Decreases operator's approvals left
  function __decreaseOperatorApprovalsLeft(address owner, address operator) private {
    // read how much approvals this operator has
    uint256 approvalsLeft = operators[owner][operator];

    // check if approvals exist – we don't want to fire an event in vain
    if (approvalsLeft != 0) {
      // update approvals left
      operators[owner][operator] = --approvalsLeft;

      // emit an event
      emit ApprovalForAll(owner, operator, approvalsLeft);
    }
  }

  /// @dev Move a `card` from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __move(address from, address to, Card storage card) private {
    // get a reference to the collection where card is now
    uint16[] storage f = collections[from];

    // get a reference to the collection where card goes to
    uint16[] storage t = collections[to];

    // collection `f` cannot be empty, if it is - it's a bug
    assert(f.length != 0);

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
