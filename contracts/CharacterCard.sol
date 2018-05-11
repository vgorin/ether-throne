pragma solidity 0.4.23;

// TODO 1) review which ERC721 functions need to be added
// TODO 2) remove all the asserts before the production release
// TODO 3) improve `exists` performance by introducing existent cards bitmask
// TODO 4) implement global features functionality

/**
 * @notice Character card is unique tradable entity. Non-fungible.
 *      We will call "character card" also just "token" or "card token"
 * @dev Card is an ERC721 non-fungible token, which maps Card ID (Token ID),
 *      a number in range 1..5000 to a set of card properties -
 *      attributes (mostly immutable by their nature) and state variables (mutable)
 * @dev A card token supports minting but not burning, it cannot be destroyed
 * @dev ERC20-compatibility: full ERC20 compatibility with security limitation for transfers:
 *      `transfer` and `transferFrom` functions support sending only entire balance
 *      (`n = balanceOf(owner)`) by default; this behavior can be controlled using
 *      `ERC20_INSECURE_TRANSFERS` feature flag
 * @dev ERC721-compatibility: partial
 *      Note: ERC721 is still a draft at the moment of writing this smart contract,
 *      therefore implementing this "standard" fully doesn't make any sense
 */
contract CharacterCard {
  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant CHAR_CARD_VERSION = 0xA;

  /// @dev Tokens within the reserved space cannot be issued/minted
  /// @dev This limitation is required to support ERC20 compatible transfers:
  ///      numbers outside this space are treated as token IDs, while
  ///      numbers inside this space are treated to be token amounts
  uint16 public constant RESERVED_TOKEN_ID_SPACE = 0x400;

  /// @dev ERC20 compliant token symbol
  string public constant symbol = "ET";
  /// @dev ERC20 compliant token name
  string public constant name = "Character Card - Ether Throne";
  /// @dev ERC20 compliant token decimals
  /// @dev this can be only zero, since ERC721 token is non-fungible
  uint8 public constant decimals = 0;

  /// @dev A character card data structure
  /// @dev Occupies 64 bytes of storage (512 bits)
  struct Card {
    /// High 256 bits
    /// @dev Card creation time, immutable, cannot be zero
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card was created
    uint32 creationTime;

    /// @dev Initialized on card creation, immutable
    /// @dev Defines card rarity type like
    ///      casual, rare, ultra rare, legendary, hologram, etc.
    /// @dev Only 5 lower bits are used, rarity is a number in range [0-16]
    uint32 rarity;

    /// @dev Initially zero, changes when attributes are modified
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's attributes were changed
    uint32 attributesModified;

    /// @dev A bitmask of the card attributes, allows storing up
    ///      to 32 attributes
    /// @dev Common attributes are stored on lower bits,
    ///      while higher bits store more rare attributes
    /// @dev Is initialized with at least 3 active attributes
    ///      (three lowest bits set to 1)
    /// @dev Only 16 lower bits are used
    uint32 attributes;

    /// @dev Initially zero, changes after each game played
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's played a game (released from a game)
    uint32 lastGamePlayed;

    /// @dev Initially zero, increases after each game played
    uint32 gamesPlayed;

    /// @dev Initially zero, increases after each game won
    uint32 wins;

    /// @dev Initially zero, increases after each game lost
    uint32 losses;


    /// Low 256 bits
    /// @dev Card ID, immutable, cannot be zero
    uint16 id;

    /// @dev Card index within an owner's collection of cards
    uint16 index;

    /// @dev Initially zero, stores card state data,
    ///      such as is card currently in game or not,
    ///      status of the last game played, etc
    /// @dev Only 3 lower bits are used, modified by `battleComplete` function
    uint32 state;

    /// @dev Initially zero, changes when ownership is transferred
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's ownership was changed
    uint32 ownershipModified;

    /// @dev Card's owner, initialized upon card creation
    address owner;
  }

  /// @notice All the emitted cards
  /// @dev Core of the Character Card as ERC721 token
  /// @dev Maps Card ID => Card Data Structure
  mapping(uint16 => Card) public cards;

  /// @dev Mapping from a token ID to an address approved to
  ///      transfer ownership rights for this card
  mapping(uint16 => address) public approvals;

  /// @dev Mapping from owner to operator approvals
  ///      token owner => approved token operator => approvals left (zero means no approval)
  /// @dev ERC20 compliant structure for
  ///      function allowance(address owner, address spender) public constant returns (uint256 remaining)
  mapping(address => mapping(address => uint256)) public allowance;

  /// @notice Storage for a collections of tokens
  /// @notice A collection of tokens is an ordered list of token IDs,
  ///      owned by a particular address (owner)
  /// @dev A mapping from owner to a collection of his tokens (IDs)
  /// @dev ERC20 compliant structure for balances can be derived
  ///      as a length of each collection in the mapping
  /// @dev ERC20 balances[owner] is equal to collections[owner].length
  mapping(address => uint16[]) public collections;

  /// @notice Defines a privileged addresses with additional
  ///      permissions on the smart contract, like minting tokens,
  ///      transferring on behalf and so on
  /// @dev Maps an address to the permissions bitmask (role), where each bit
  ///      represents a permissions; bitmask 0xFFFFFFFF represents all possible permissions
  mapping(address => uint32) public userRoles;

  /// @notice Total number of existing tokens
  /// @dev ERC20 compliant field for totalSupply()
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

  /// @dev A bitmask of globally enabled features, see below
  uint32 public f;

  /// @dev Enables ERC721 transfers of the tokens
  uint32 public constant FEATURE_TRANSFERS = 0x00000001;

  /// @dev Enables ERC721 transfers on behalf
  uint32 public constant FEATURE_TRANSFERS_ON_BEHALF = 0x00000002;

  /// @dev Enables partial support of ERC20 transfers of the tokens,
  ///      allowing to transfer only all owned tokens at once
  uint32 public constant ERC20_TRANSFERS = 0x00000004;

  /// @dev Enables partial support of ERC20 transfers on behalf
  ///      allowing to transfer only all owned tokens at once
  uint32 public constant ERC20_TRANSFERS_ON_BEHALF = 0x00000008;

  /// @dev Enables full support of ERC20 transfers of the tokens,
  ///      allowing to transfer arbitrary amount of the tokens at once
  uint32 public constant ERC20_INSECURE_TRANSFERS = 0x00000010;

  /// @notice Exchange is responsible for trading tokens on behalf of tokens holders
  /// @dev Role ROLE_EXCHANGE allows executing transfer on behalf of tokens holders
  /// @dev Not used
  //uint32 public constant ROLE_EXCHANGE = 0x00010000;

  /// @notice Card game provider is responsible for enabling the game protocol
  /// @dev Role ROLE_COMBAT_PROVIDER allows modifying gamesPlayed,
  ///      wins, losses, state, lastGamePlayed, attributes
  uint32 public constant ROLE_COMBAT_PROVIDER = 0x00020000;

  /// @notice Token creator is responsible for creating tokens
  /// @dev Role ROLE_TOKEN_CREATOR allows minting tokens
  uint32 public constant ROLE_TOKEN_CREATOR = 0x00040000;

  /// @notice Token destroyer is responsible for destroying tokens
  /// @dev Role ROLE_TOKEN_DESTROYER allows burning tokens
  /// @dev Reserved, not used
  //uint32 public constant ROLE_TOKEN_DESTROYER = 0x00080000;

  /// @notice Role manager is responsible for assigning the roles
  /// @dev Role ROLE_ROLE_MANAGER allows executing addOperator/removeOperator
  uint32 public constant ROLE_ROLE_MANAGER = 0x00100000;

  /// @notice Feature manager is responsible for enabling/disabling
  ///      global features of the smart contract
  /// @dev Role ROLE_FEATURE_MANAGER allows enabling/disabling global features
  uint32 public constant ROLE_FEATURE_MANAGER = 0x00200000;

  /// @dev Bitmask represents all the possible permissions (super admin role)
  uint32 public constant FULL_PRIVILEGES_MASK = 0xFFFFFFFF;

  /// @dev The number is used as unlimited approvals number
  uint256 public constant UNLIMITED_APPROVALS = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /// @dev Event names are self-explanatory:
  /// @dev Fired in mint()
  /// @dev Address `_by` allows to track who created a token
  event Minted(address indexed _by, address indexed _to, uint16 indexed _tokenId);
  /// @dev Fired in transfer(), transferFor(), mint()
  /// @dev When minting a token, address `_from` is zero
  event TokenTransfer(address indexed _from, address indexed _to, uint16 indexed _tokenId);
  /// @dev Fired in transfer(), transferFor(), mint()
  /// @dev When minting a token, address `_from` is zero
  /// @dev ERC20 compliant event
  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  /// @dev Fired in approveToken()
  event TokenApproval(address indexed _owner, address indexed _approved, uint16 indexed _tokenId);
  /// @dev Fired in approve()
  /// @dev ERC20 compliant event
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
  /// @dev Fired in battlesComplete(), battleComplete()
  event BattleComplete(
    uint16 indexed card1Id,// card1 ID
    uint16 indexed card2Id,// card2 ID
    uint32 wins,           // card1 wins = card2 losses
    uint32 losses,         // card1 losses = card2 wins
    uint32 gamesPlayed,    // card1 games played = card2 games played
    uint8  lastGameOutcome // card1 last game outcome = 4 - card2 last game outcome
  );

  /**
   * @dev Creates a character card as a ERC721 token
   */
  constructor() public {
    // call sender gracefully - contract `creator`
    address creator = msg.sender;

    // creator has full privileges
    userRoles[creator] = FULL_PRIVILEGES_MASK;
  }

  /**
   * @dev Updates set of the globally enabled features (`f`),
   *      taking into account sender's permissions.
   * @dev Requires sender to have `ROLE_FEATURE_MANAGER` permission.
   * @param mask bitmask representing a set of features to enable/disable
   */
  function updateFeatures(uint32 mask) public {
    // call sender nicely - caller
    address caller = msg.sender;
    // read caller's permissions
    uint32 p = userRoles[caller];

    // caller should have a permission to update global features
    require(__hasRole(p, ROLE_FEATURE_MANAGER));

    // taking into account caller's permissions,
    // 1) enable features requested
    f |= p & mask;
    // 2) disable features requested
    f &= FULL_PRIVILEGES_MASK ^ (p & (FULL_PRIVILEGES_MASK ^ mask));
  }

  /**
   * @dev Adds a new `operator` - an address which has
   *      some extended privileges over the smart contract,
   *      for example token minting, transferring on behalf, etc.
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
    require(__hasRole(p, ROLE_ROLE_MANAGER));

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
    require(__isSenderInRole(ROLE_ROLE_MANAGER));

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
    require(__hasRole(p, ROLE_ROLE_MANAGER));

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
    require(__hasRole(p, ROLE_ROLE_MANAGER));

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
   *          creationTime,
   *          rarity,
   *          attributesModified,
   *          attributes,
   *          lastGamePlayed,
   *          gamesPlayed,
   *          wins,
   *          losses,
   *      Second integer (low bits) contains (from higher to lower bits order):
   *          id,
   *          index,
   *          state
   *          ownershipModified,
   *          owner
   * @dev Throws if card doesn't exist
   * @param tokenId ID of the card to fetch
   */
  function getCard(uint16 tokenId) public constant returns(uint256, uint256) {
    // load the card from storage
    Card memory card = cards[tokenId];

    // get the card's owner address
    address owner = card.owner;

    // validate card existence
    require(owner != address(0));

    // pack high 256 bits of the result
    uint256 high = uint256(card.creationTime) << 224
                 | uint224(card.rarity) << 192
                 | uint192(card.attributesModified) << 160
                 | uint160(card.attributes) << 128
                 | uint128(card.lastGamePlayed) << 96
                 | uint96(card.gamesPlayed) << 64
                 | uint64(card.wins) << 32
                 | uint32(card.losses);

    // pack low 256 bits of the result
    uint256 low = uint256(card.id) << 240
                | uint240(card.index) << 224
                | uint224(card.state) << 192
                | uint192(card.ownershipModified) << 160
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
   * @dev Requires sender to have `ROLE_COMBAT_PROVIDER` permission
   * @param bitmask a value to set `lockedBitmask` to
   */
  function setLockedBitmask(uint32 bitmask) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

    // update the locked bitmask
    lockedBitmask = bitmask;
  }

  /**
   * @dev Gets the state of a card
   * @param tokenId ID of the card to get state for
   * @return a card state
   */
  function getState(uint16 tokenId) public constant returns(uint32) {
    // get the card from storage
    Card memory card = cards[tokenId];

    // validate card existence
    require(card.owner != address(0));

    // obtain card's state and return
    return card.state;
  }

  /**
   * @dev Sets the state of a card
   * @dev Requires sender to have `ROLE_COMBAT_PROVIDER` permission
   * @param tokenId ID of the card to set state for
   * @param state new state to set for the card
   */
  function setState(uint16 tokenId, uint32 state) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

    // check that card to set state for exists
    require(card.owner != address(0));

    // set the state required
    card.state = state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
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
    battlesComplete(card1Id, card2Id, wins, losses, 1, outcome);
  }

  /**
   * @dev A mechanism to update two cards which were engaged in several battles
   * @dev Same as `battleComplete(uint16, uint16, outcome)` but allows for a batch update
   * @param card1Id first card's ID engaged in a battle
   * @param card2Id second card's ID engaged in a battle
   * @param wins number of times 1st card won (2nd lost)
   * @param losses number of times 1st card lost (2nd won)
   * @param gamesPlayed total games played, cannot exceed wins + losses, cannot be zero
   */
  function battlesComplete(
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
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

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
   * @param tokenId ID of the card to get attributes for
   * @return a card attributes bitmask
   */
  function getAttributes(uint16 tokenId) public constant returns(uint32) {
    // get the card from storage
    Card memory card = cards[tokenId];

    // validate card existence
    require(card.owner != address(0));

    // read the attributes and return
    return card.attributes;
  }

  /**
   * @dev Sets attributes of a card
   * @dev Erases all previously set attributes
   * @param tokenId ID of the card to set attributes for
   * @param attributes bitmask representing card attributes to set
   */
  function setAttributes(uint16 tokenId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

    // check that card to set attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // set the attributes required
    card.attributes = attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Adds attributes to a card
   * @dev Preserves all previously set attributes
   * @param tokenId ID of the card to add attributes to
   * @param attributes bitmask representing card attributes to add
   */
  function addAttributes(uint16 tokenId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

    // check that card to add attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // add the attributes required
    card.attributes |= attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Removes attributes from a card
   * @dev Preserves all the attributes which are not specified by `attributes`
   * @param tokenId ID of the card to remove attributes from
   * @param attributes bitmask representing card attributes to remove
   */
  function removeAttributes(uint16 tokenId, uint32 attributes) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_COMBAT_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

    // check that card to remove attributes for exists
    require(card.owner != address(0));

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // add the attributes required
    card.attributes &= 0xFFFFFFFF ^ attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @notice Gets an amount of tokens owned by the given address
   * @dev Gets the balance of the specified address
   * @param who address to query the balance for
   * @return an amount owned by the address passed as an input parameter
   */
  function balanceOf(address who) public constant returns (uint16) {
    // read the length of the `who`s collection of tokens
    return uint16(collections[who].length);
  }

  /**
   * @notice Checks if specified token exists
   * @dev Returns whether the specified token ID exists
   * @param tokenId ID of the token to query the existence for
   * @return whether the token exists (true - exists)
   */
  function exists(uint16 tokenId) public constant returns (bool) {
    // get the token's owner address from storage
    address owner = cards[tokenId].owner;

    // check if this token exists (owner is not zero)
    return owner != address(0);
  }

  /**
   * @notice Finds an owner address for a token specified
   * @dev Gets the owner of the specified token from the `cards` mapping
   * @dev Throws if a token with the ID specified doesn't exist
   * @param tokenId ID of the token to query the owner for
   * @return owner address currently marked as the owner of the given card
   */
  function ownerOf(uint16 tokenId) public constant returns (address) {
    // get the token's owner address from storage
    address owner = cards[tokenId].owner;

    // check if this token exists (owner is not zero)
    require(owner != address(0));

    // return owner's address
    return owner;
  }

  /**
   * @dev Creates new card with `tokenId` ID specified and
   *      assigns to an address `to` an ownership of that card
   * @param tokenId ID of the card to create
   * @param to an address to assign created card ownership to
   */
  function mint(address to, uint16 tokenId) public {
    // delegate call to `mintWith`
    mintWith(to, tokenId, 3);
  }

  /**
   * @dev Creates new card with `tokenId` ID specified and
   *      assigns an ownership `to` for that card
   * @dev Allows setting card's rarity / attributes
   * @param to an address to assign created card ownership to
   * @param tokenId ID of the card to create
   * @param rarity an integer, representing card's rarity
   */
  function mintWith(address to, uint16 tokenId, uint32 rarity) public {
    // validate destination address
    require(to != address(0));
    require(to != address(this));

    // check if caller has sufficient permissions to mint a card
    require(__isSenderInRole(ROLE_TOKEN_CREATOR));

    // delegate call to `__mint`
    __mint(to, tokenId, rarity);

    // fire ERC20 transfer event
    emit Transfer(address(0), to, 1);
  }

  /**
   * @dev Creates several cards in a single transaction and
   *      assigns an ownership `to` for these cards
   * @dev Card ID, rarity and attributes are packed inside
   *      `data` array, each element of which contains data
   *      (card ID, rarity and attributes) for one card
   * @dev Only low 16 bits of attributes are packed into the
   *      `data` array elements, high 16 bits are treated to be zero
   * @dev Card state is initialized with zero value
   * @param to an address to assign created cards ownership to
   * @param data an array of packed card data info; each element
   *      contains a 24-bit integer:
   *        * high 16 bits represent a card ID,
   *        * low 8 bits represent card rarity data, `rarity` is a number in range 0..16
   *        * `attributes` are derived from rarity data:
   *          lower n bits are set to 1 (where n = `rarity` value), for example
   *          `rarity` value 3 corresponds to `attributes` value 7 (binary 111)
   *          `rarity` value 5 corresponds to `attributes` value 31 (binary 11111)
   */
  function mintCards(address to, uint24[] data) public {
    // validate destination address
    require(to != address(0));
    require(to != address(this));

    // how many cards we're minting
    uint16 n = uint16(data.length);

    // there should be at least one card to mint
    // also check we didn't get uint16 overflow in `n`
    require(n != 0 && n == data.length);

    // check if caller has sufficient permissions to mint a card
    require(__isSenderInRole(ROLE_TOKEN_CREATOR));

    // iterate over `data` array and mint each card specified
    for(uint256 i = 0; i < n; i++) {
      // unpack card from data element
      // and delegate call to `__mint`
      __mint(to, uint16(data[i] >> 8), 0xFF & data[i]);
    }

    // fire ERC20 transfer event
    emit Transfer(address(0), to, n);
  }

  /**
   * @notice Transfers ownership rights of `n` *arbitrary* tokens
   *      to a new owner specified by address `to`
   * @dev The tokens are taken from the end of the owner's token collection
   * @dev Requires the sender of the transaction to be an owner
   *      of at least `n` tokens
   * @dev For security reasons this function will throw if transferring
   *      less tokens than is owned by the sender (`n != balanceOf(msg.sender)`) -
   *      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
   * @dev Consumes around 38521 + 511735 * (`n` / 16) gas for `n` multiple of 16
   * @dev ERC20 compliant transfer(address, uint)
   * @param to an address where to transfer tokens to,
   *        new owner of the tokens
   * @param n number of tokens to transfer
   */
  function transfer(address to, uint16 n) public {
    // call sender gracefully - `from`
    address from = msg.sender;

    // delegate call to unsafe `__transfer`
    __transfer(from, to, n);
  }

  /**
   * @notice A.k.a "transfer on behalf"
   * @notice Transfers ownership rights of `n` *arbitrary* tokens
   *      to a new owner specified by address `to`
   * @dev The tokens are taken from the end of the owner's token collection
   * @dev Requires the sender of the transaction to be authorized
   *      to "spend" at least `n` tokens
   * @dev The sender is granted an authorization to "spend" the tokens
   *      by the owner of the tokens using `approve` function
   * @dev For security reasons this function will throw if transferring
   *      less tokens than is owned by an owner (`n != balanceOf(from)`) -
   *      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
   * @param from an address from where to take tokens from,
   *        current owner of the tokens
   * @param to an address where to transfer tokens to,
   *        new owner of the tokens
   * @param n number of tokens to transfer
   */
  function transferFrom(address from, address to, uint16 n) public {
    // call sender gracefully - `operator`
    address operator = msg.sender;

    // we assume `from` has at least n tokens to transfer,
    // this will be explicitly checked in `__transfer`

    // fetch how much approvals left for an operator
    uint256 approvalsLeft = allowance[from][operator];

    // operator must be approved to transfer `n` tokens on behalf
    // otherwise this is equal to regular transfer,
    // where `from` is basically a transaction sender and owner of the tokens
    if(approvalsLeft < n) {
      // transaction sender doesn't have required amount of approvals left
      // we will treat him as an owner trying to send his own tokens
      // check `from` to be `operator` (transaction sender):
      require(from == operator);
    }
    else {
      // update operator's approvals left + emit an event
      __decreaseOperatorApprovalsLeft(from, operator, n);
    }

    // delegate call to unsafe `__transfer`
    __transfer(from, to, n);
  }

  /**
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @dev Requires the sender of the transaction to be an owner
   *      of the token specified (`tokenId`)
   * @param to new owner address
   * @param tokenId ID of the token to transfer ownership rights for
   */
  function transferToken(address to, uint16 tokenId) public {
    // call sender gracefully - `from`
    address from = msg.sender;

    // delegate call to unsafe `__transferToken`
    __transferToken(from, to, tokenId);
  }

  /**
   * @notice A.k.a "transfer a token on behalf"
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @notice Allows transferring ownership rights by a trading operator
   *      on behalf of token owner. Allows building an exchange of tokens.
   * @dev Transfers the ownership of a given token ID to another address
   * @dev Requires the transaction sender to be the owner, approved, or operator
   * @param from current owner of the token
   * @param to address to receive the ownership of the token
   * @param tokenId ID of the token to be transferred
   */
  function transferTokenFrom(address from, address to, uint16 tokenId) public {
    // call sender gracefully - `operator`
    address operator = msg.sender;
    // find if an approved address exists for this token
    address approved = approvals[tokenId];

    // we assume `from` is an owner of the token,
    // this will be explicitly checked in `__transferToken`

    // fetch how much approvals left for an operator
    uint256 approvalsLeft = allowance[from][operator];

    // operator must have an approval to transfer this particular token
    // or operator must be approved to transfer all the tokens
    // or, if nothing satisfies, this is equal to regular transfer,
    // where `from` is basically a transaction sender and owner of the token
    if(operator == approved || approvalsLeft != 0) {
      // update operator's approvals left + emit an event
      __decreaseOperatorApprovalsLeft(from, operator, 1);
    }
    else {
      // transaction sender doesn't have any special permissions
      // we will treat him as a token owner and sender and try to perform
      // a regular transfer:
      // check `from` to be `operator` (transaction sender):
      require(from == operator);
    }

    // delegate call to unsafe `__transferToken`
    __transferToken(from, to, tokenId);
  }

  /**
   * @notice Approves an address to transfer the given token on behalf of its owner
   *      Can also be used to revoke an approval by setting `to` address to zero
   * @dev The zero `to` address revokes an approval for a given token
   * @dev There can only be one approved address per token at a given time
   * @dev This function can only be called by the token owner
   * @param to address to be approved to transfer the token on behalf of its owner
   * @param tokenId ID of the token to be approved for transfer on behalf
   */
  function approveToken(address to, uint16 tokenId) public {
    // call sender nicely - `from`
    address from = msg.sender;
    // get token owner address (also ensures that token exists)
    address owner = ownerOf(tokenId);

    // caller must own this token
    require(from == owner);
    // approval for owner himself is pointless, do not allow
    require(to != owner);
    // either we're removing approval, or setting it
    require(approvals[tokenId] != address(0) || to != address(0));

    // set an approval (deletes an approval if to == 0)
    approvals[tokenId] = to;

    // emit an ERC721 event
    emit TokenApproval(msg.sender, to, tokenId);
  }

  /**
   * @notice Removes an approved address, which was previously added by `approve`
   *      for the given token. Equivalent to calling approve(0, tokenId)
   * @dev Same as calling approve(0, tokenId)
   * @param tokenId ID of the token to remove approved address for
   */
  function revokeApproval(uint16 tokenId) public {
    // delegate call to `approve`
    approveToken(address(0), tokenId);
  }

  /**
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer *all* tokens of the sender on their behalf
   * @param to operator address to set the approval for
   * @param approved representing the status of the approval to be set
   */
  function setApprovalForAll(address to, bool approved) public {
    // set maximum possible approval, 2^256 – 1, unlimited de facto
    approve(to, approved ? UNLIMITED_APPROVALS : 0);
  }

  /**
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer *all* tokens of the sender on their behalf
   * @dev ERC20 compliant approve(address, uint256) function
   * @param to operator address to set the approval
   * @param approved representing the number of approvals left to be set
   */
  function approve(address to, uint256 approved) public {
    // call sender nicely - `from`
    address from = msg.sender;

    // validate destination address
    require(to != address(0));

    // approval for owner himself is pointless, do not allow
    require(to != from);

    // set an approval
    allowance[from][to] = approved;

    // emit an ERC20 compliant event
    emit Approval(from, to, approved);
  }

  /// @dev Checks if requested feature is enabled globally on the contract
  function __isFeatureEnabled(uint32 featureRequired) private constant returns(bool) {
    // delegate call to `__hasRole`
    return __hasRole(f, featureRequired);
  }

  /// @dev Checks if transaction sender `msg.sender` has all the required permissions `roleRequired`
  function __isSenderInRole(uint32 roleRequired) private constant returns(bool) {
    // call sender gracefully - `user`
    address user = msg.sender;

    // read user's permissions (role)
    uint32 userRole = userRoles[user];

    // delegate call to `__hasRole`
    return __hasRole(userRole, roleRequired);
  }

  /// @dev Checks if user role `userRole` contain all the permissions required `roleRequired`
  function __hasRole(uint32 userRole, uint32 roleRequired) private pure returns(bool) {
    // check the bitmask for the role required and return the result
    return userRole & roleRequired == roleRequired;
  }

  /// @dev Creates new card with `tokenId` ID specified and
  ///      assigns an ownership `to` for this card
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call
  ///      checks only that the card doesn't exist yet
  /// @dev Must be kept private at all times
  function __mint(address to, uint16 tokenId, uint32 rarity) private {
    // check that `tokenId` is not in the reserved space
    require(tokenId > RESERVED_TOKEN_ID_SPACE);

    // ensure that token with such ID doesn't exist
    require(!exists(tokenId));

    // create a new card in memory
    Card memory card = Card({
      creationTime: uint32(block.number),
      rarity: rarity,
      attributesModified: 0,
      attributes: uint32((uint64(1) << uint64(0x3F & rarity)) - 1),
      lastGamePlayed: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,

      id: tokenId,
      // card index within the owner's collection of cards
      // points to the place where the card will be placed to
      index: uint16(collections[to].length),
      state: 0,
      ownershipModified: 0,
      owner: to
    });

    // push newly created card's ID to the owner's collection of cards
    collections[to].push(tokenId);

    // persist card to the storage
    cards[tokenId] = card;

    // update total supply
    totalSupply++;

    // fire Minted event
    emit Minted(msg.sender, to, tokenId);
    // fire ERC721 transfer event
    emit TokenTransfer(address(0), to, tokenId);
  }

  /// @dev Performs a transfer of `n` tokens from address `from` to address `to`
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call;
  ///      checks only that address `from` has at least `n` tokens on the balance
  /// @dev For security reasons this function throws if transferring
  ///      less tokens than is owned by an owner (`n != balanceOf(from)`) -
  ///      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
  /// @dev Is save to call from `transfer(to, n)` since it doesn't need any additional checks
  /// @dev Must be kept private at all times
  function __transfer(address from, address to, uint16 n) private {
    // validate source and destination address
    require(to != address(0));
    require(to != from);
    // impossible by design of transfer(), transferFrom() and approve()
    // if it happens - its a bug
    assert(from != address(0));

    // for security reasons we require `n` to be within `RESERVED_TOKEN_ID_SPACE`
    // otherwise it can mean an attempt to transfer a particular token (not `n` tokens)
    require(n > 0 && n <= RESERVED_TOKEN_ID_SPACE);

    // by default, when `ERC20_INSECURE_TRANSFERS` is not enabled, we
    // verify that the source address owns exactly `n` tokens -
    // this may be important for security reasons:
    // we may want to secure owner from sending some amount of tokens
    // accidentally instead of sending a token by ID
    require(n == balanceOf(from) || __isFeatureEnabled(ERC20_INSECURE_TRANSFERS));

    // for security reasons remove approved operator
    delete allowance[from][msg.sender];

    // move `n` tokens
    __move(from, to, n);

    // fire a ERC20 transfer event
    emit Transfer(from, to, n);
  }

  /// @dev Performs a transfer of a token `tokenId` from address `from` to address `to`
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call;
  ///      checks only for token existence and that ownership belongs to `from`
  /// @dev Is save to call from `transferToken(to, tokenId)` since it doesn't need any additional checks
  /// @dev Must be kept private at all times
  function __transferToken(address from, address to, uint16 tokenId) private {
    // validate source and destination address
    require(to != address(0));
    require(to != from);
    // impossible by design of transferToken(), transferTokenFrom(),
    // approveToken() and approve()
    assert(from != address(0));

    // get the card pointer to the storage
    Card storage card = cards[tokenId];

    // get token's owner address
    address owner = card.owner;

    // validate token existence
    require(owner != address(0));
    // validate token ownership
    require(owner == from);

    // transfer is not allowed for a locked card
    // (ex.: if card is currently in game/battle)
    require(card.state & lockedBitmask == 0);

    // clear approved address for this particular token + emit event
    __clearApprovalFor(tokenId);

    // move card ownership,
    // update old and new owner's card collections accordingly
    __moveCard(from, to, card);

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire ERC721 transfer event
    emit TokenTransfer(from, to, tokenId);

    // fire a ERC20 transfer event
    emit Transfer(from, to, 1);
  }

  /// @dev Clears approved address for a particular token
  function __clearApprovalFor(uint16 tokenId) private {
    // check if approval exists - we don't want to fire an event in vain
    if(approvals[tokenId] != address(0)) {
      // clear approval
      delete approvals[tokenId];

      // emit an ERC721 event
      emit TokenApproval(msg.sender, address(0), tokenId);
    }
  }

  /// @dev Decreases operator's approvals left
  /// @dev Unsafe, doesn't throw if there is not enough approvals left
  function __decreaseOperatorApprovalsLeft(address owner, address operator, uint256 n) private {
    // read how much approvals this operator has
    uint256 approvalsLeft = allowance[owner][operator];

    // check if approvals exist – we don't want to fire an event in vain
    if (approvalsLeft != 0) {
      // recalculate the approvals left
      approvalsLeft = approvalsLeft > n ? approvalsLeft - n : 0;

      // update approvals left
      allowance[owner][operator] = approvalsLeft;

      // emit an ERC20 compliant event
      emit Approval(owner, operator, approvalsLeft);
    }
  }

  /// @dev Move `n` the tokens from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __move(address from, address to, uint16 n) private {
    // get a reference to the `from` collection
    uint16[] storage source = collections[from];

    // get a reference to the `to` collection
    uint16[] storage destination = collections[to];

    // check `n` is in safe bounds
    require(n <= source.length);

    // initial position of the tokens to be moved in `destination` array
    uint16 offset = uint16(destination.length);

    // copy last `n` tokens from `source` to `destination`
    for(uint16 i = uint16(source.length) - n; i < source.length; i++) {
      // get the link to a card from the source collection
      Card storage card = cards[source[i]];

      // cardId must be consistent with the collections by design
      // otherwise this is a bug
      assert(source[i] == card.id);

      // moving a card is not allowed for a locked card
      // (ex.: if card is currently in game/battle)
      require(card.state & lockedBitmask == 0);

      // update card index to position in `destination` collection
      card.index = offset + i;

      // update card owner
      card.owner = to;

      // update ownership transfer date
      card.ownershipModified = uint32(block.number);

      // write the card to destination collection
      destination.push(source[i]);

      // emit ERC721 transfer event
      emit TokenTransfer(from, to, source[i]);
    }

    // trim source (`from`) collection array by `n`
    source.length -= n;
  }

  /// @dev Move a `card` from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __moveCard(address from, address to, Card storage card) private {
    // get a reference to the collection where card is now
    uint16[] storage source = collections[from];

    // get a reference to the collection where card goes to
    uint16[] storage destination = collections[to];

    // collection `source` cannot be empty, if it is - it's a bug
    assert(source.length != 0);

    // index of the card within collection `source`
    uint16 i = card.index;

    // we put the last card in the collection `source` to the position released
    // get an ID of the last card in `source`
    uint16 tokenId = source[source.length - 1];

    // update card index to point to proper place in the collection `source`
    cards[tokenId].index = i;

    // put it into the position i within `source`
    source[i] = tokenId;

    // trim the collection `source` by removing last element
    source.length--;

    // update card index according to position in new collection `destination`
    card.index = uint16(destination.length);

    // update card owner
    card.owner = to;

    // update ownership transfer date
    card.ownershipModified = uint32(block.number);

    // push card into collection
    destination.push(card.id);
  }

}
