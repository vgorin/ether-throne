pragma solidity 0.4.23;

import "./AccessControl.sol";

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
contract CharacterCard is AccessControl {
  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant CHAR_CARD_VERSION = 0xB;

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
    /// @dev Initially zero, changes when attributes are modified
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's attributes were changed
    uint32 attributesModified;

    /// @dev A bitmask of the card attributes, allows storing up
    ///      to 64 attributes
    /// @dev Common attributes are stored on lower bits,
    ///      while higher bits store more rare attributes
    /// @dev Is initialized with at least 3 active attributes
    ///      (three lowest bits set to 1)
    uint64 attributes;

    /// @dev Initially zero, changes when state gets modified
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's state was changed
    uint32 stateModified;

    /// @dev Initially zero, may be used to store card state data,
    ///      such as is card currently in game or not,
    ///      status of the last game played, etc
    uint128 state;

    /// Low 256 bits
    /// @dev Card creation time, immutable, cannot be zero
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card was created
    uint32 creationTime;

    /// @dev Card ID, immutable, cannot be zero
    uint16 id;

    /// @dev Card index within an owner's collection of cards
    uint16 index;

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

  /// @notice Total number of existing tokens
  /// @dev ERC20 compliant field for totalSupply()
  uint16 public totalSupply;

  /// @dev The data in card's state may contain lock(s)
  ///      (ex.: is card currently in the game or not)
  /// @dev A locked card cannot be transferred
  /// @dev The card is locked if it contains any bits
  ///      from the `lockedBitmask` in its `state` set
  uint32 public lockedBitmask = 0x4;

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

  /// @notice Token creator is responsible for creating tokens
  /// @dev Role ROLE_TOKEN_CREATOR allows minting tokens
  uint32 public constant ROLE_TOKEN_CREATOR = 0x00040000;

  /// @notice Token destroyer is responsible for destroying tokens
  /// @dev Role ROLE_TOKEN_DESTROYER allows burning tokens
  /// @dev Reserved, not used
  //uint32 public constant ROLE_TOKEN_DESTROYER = 0x00080000;

  /// @notice Card attributes provider is part of the game protocol
  /// @dev Role ROLE_ATTR_PROVIDER allows modifying card state
  uint32 public constant ROLE_ATTR_PROVIDER = 0x00100000;

  /// @notice Card state provider is part of the game protocol
  /// @dev Role ROLE_STATE_PROVIDER allows modifying card state
  uint32 public constant ROLE_STATE_PROVIDER = 0x00200000;

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
  function getPacked(uint16 tokenId) public constant returns(uint256, uint256) {
    // validate card existence
    require(exists(tokenId));

    // load the card from storage
    Card memory card = cards[tokenId];

    // pack high 256 bits of the result
    uint256 high = uint256(card.attributesModified) << 224
                 | uint224(card.attributes) << 160
                 | uint160(card.stateModified) << 128
                 | uint128(card.state);

    // pack low 256 bits of the result
    uint256 low  = uint256(card.creationTime) << 224
                 | uint224(card.id) << 208
                 | uint208(card.index) << 192
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
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // update the locked bitmask
    lockedBitmask = bitmask;
  }

  /**
   * @dev Gets the state of a card
   * @param tokenId ID of the card to get state for
   * @return a card state
   */
  function getState(uint16 tokenId) public constant returns(uint128) {
    // validate card existence
    require(exists(tokenId));

    // obtain card's state and return
    return cards[tokenId].state;
  }

  /**
   * @dev Sets the state of a card
   * @dev Requires sender to have `ROLE_COMBAT_PROVIDER` permission
   * @param tokenId ID of the card to set state for
   * @param state new state to set for the card
   */
  function setState(uint16 tokenId, uint128 state) public {
    // check that card to set state for exists
    require(exists(tokenId));

    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // set state modified timestamp
    cards[tokenId].stateModified = uint32(block.number);

    // set the state required
    cards[tokenId].state = state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Adds state attributes to a card
   * @dev Preserves all previously set state attributes
   * @param tokenId ID of the card to add state attributes to
   * @param state bitmask representing card state attributes to add
   */
  function addStateAttributes(uint16 tokenId, uint128 state) public {
    // check that card to add state attributes for exists
    require(exists(tokenId));

    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // set state modified timestamp
    cards[tokenId].stateModified = uint32(block.number);

    // add the state attributes required
    cards[tokenId].state |= state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Removes state attributes from a card
   * @dev Preserves all the state attributes which are not specified by `state`
   * @param tokenId ID of the card to remove state attributes from
   * @param state bitmask representing card state attributes to remove
   */
  function removeStateAttributes(uint16 tokenId, uint128 state) public {
    // check that card to remove state attributes from exists
    require(exists(tokenId));

    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // set state modified timestamp
    cards[tokenId].stateModified = uint32(block.number);

    // add the state attributes required
    cards[tokenId].state &= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF ^ state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)
  }

  /**
   * @dev Gets attributes of a card
   * @param tokenId ID of the card to get attributes for
   * @return a card attributes bitmask
   */
  function getAttributes(uint16 tokenId) public constant returns(uint64) {
    // validate card existence
    require(exists(tokenId));

    // read the attributes and return
    return cards[tokenId].attributes;
  }

  /**
   * @dev Sets attributes of a card
   * @dev Erases all previously set attributes
   * @param tokenId ID of the card to set attributes for
   * @param attributes bitmask representing card attributes to set
   */
  function setAttributes(uint16 tokenId, uint64 attributes) public {
    // check that card to set attributes for exists
    require(exists(tokenId));

    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

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
  function addAttributes(uint16 tokenId, uint64 attributes) public {
    // check that card to add attributes for exists
    require(exists(tokenId));

    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

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
  function removeAttributes(uint16 tokenId, uint64 attributes) public {
    // check that card to remove attributes for exists
    require(exists(tokenId));

    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // get the card pointer
    Card storage card = cards[tokenId];

    // set attributes modified timestamp
    card.attributesModified = uint32(block.number);

    // add the attributes required
    card.attributes &= 0xFFFFFFFFFFFFFFFF ^ attributes;

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
    // check if this token exists (owner is not zero)
    return cards[tokenId].owner != address(0);
  }

  /**
   * @notice Finds an owner address for a token specified
   * @dev Gets the owner of the specified token from the `cards` mapping
   * @dev Throws if a token with the ID specified doesn't exist
   * @param tokenId ID of the token to query the owner for
   * @return owner address currently marked as the owner of the given card
   */
  function ownerOf(uint16 tokenId) public constant returns (address) {
    // check if this token exists
    require(exists(tokenId));

    // return card's owner (address)
    return cards[tokenId].owner;
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
   * @param rarity an integer, representing card's initial attributes set -
   *      attributes have `rarity` low bits set
   */
  function mintWith(address to, uint16 tokenId, uint8 rarity) public {
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
      __mint(to, uint16(data[i] >> 8), uint8(data[i]));
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
    emit TokenApproval(from, to, tokenId);
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

  function __attributes(uint8 rarity) public pure returns(uint64) {
    return uint64(1 << uint256(rarity)) - 1;
  }

  /// @dev Creates new card with `tokenId` ID specified and
  ///      assigns an ownership `to` for this card
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call
  ///      checks only that the card doesn't exist yet
  /// @dev Must be kept private at all times
  function __mint(address to, uint16 tokenId, uint8 rarity) private {
    // check that `tokenId` is not in the reserved space
    require(tokenId > RESERVED_TOKEN_ID_SPACE);

    // ensure that token with such ID doesn't exist
    require(!exists(tokenId));

    // create a new card in memory
    Card memory card = Card({
      attributesModified: 0,
      attributes: __attributes(rarity),
      stateModified: 0,
      state: 0,

      creationTime: uint32(block.number),
      id: tokenId,
      // card index within the owner's collection of cards
      // points to the place where the card will be placed to
      index: uint16(collections[to].length),
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

    // validate token existence
    require(exists(tokenId));

    // validate token ownership
    require(card.owner == from);

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
