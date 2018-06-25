pragma solidity 0.4.23;

import "./AddressUtils.sol";
import "./StringUtils.sol";
import "./ERC721Receiver.sol";
import "./ERC165.sol";
import "./AccessControl.sol";

// TODO: remove all the asserts before the production release

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
contract CharacterCard is AccessControl, ERC165 {
  /// @dev Smart contract version
  /// @dev Should be incremented manually in this source code
  ///      each time smart contact source code is changed
  uint32 public constant TOKEN_VERSION = 0xD;

  /// @dev Only tokens within the token ID space (inclusive)
  ///      can be issued/minted
  /// @dev Thus, maximum valid token ID is TOKEN_ID_SPACE
  uint16 public constant TOKEN_ID_SPACE = 0xFFFF;

  /// @dev Tokens within the reserved space (inclusive) cannot be issued/minted
  /// @dev This limitation is required to support ERC20 compatible transfers:
  ///      numbers outside this space are treated as token IDs, while
  ///      numbers inside this space are treated to be token amounts
  /// @dev This value should be half of the token ID space,
  ///      i.e. for uint16 token ID space is 65535 and reserved token ID space is 32768
  uint16 public constant RESERVED_TOKEN_ID_SPACE = 0x8000;

  /// @dev Maximum number of tokens supported by smart contract
  /// @dev The number is used as unlimited approvals number
  uint16 public constant UNLIMITED_APPROVALS = 0x7FFF;

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
    /// @dev Initially zero, changes when state gets modified
    /// @dev Stored as Ethereum Block Number of the transaction
    ///      when the card's state was changed
    uint32 stateModified;

    /// @dev Initially zero, may be used to store card state data,
    ///      such as is card currently in game or not,
    ///      status of the last game played, etc
    uint128 state;

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
  /// @dev Maps token ID => Card Data Structure
  mapping(uint256 => Card) public cards;

  /// @dev Mapping from a token ID to an address approved to
  ///      transfer ownership rights for this card
  mapping(uint256 => address) public approvals;

  /// @dev Mapping from owner to operator approvals
  ///      token owner => approved token operator => approvals left (zero means no approval)
  /// @dev ERC20 compliant structure for
  ///      function allowance(address owner, address spender) public constant returns (uint256 remaining)
  mapping(address => mapping(address => uint256)) public allowance;

  /// @notice Storage for a collections of tokens by address (owner)
  /// @notice An order in the collection is not guaranteed and may change
  ///      when a token is transferred from the collection
  /// @dev A mapping from owner to a collection of his tokens (IDs)
  /// @dev ERC20 compliant structure for balances can be derived
  ///      as a length of each collection in the mapping
  /// @dev ERC20 balances[owner] is equal to collections[owner].length
  mapping(address => uint16[]) public collections;

  /// @dev Array with all token ids, used for enumeration
  /// @dev ERC20 compliant structure for totalSupply can be derived
  ///      as a length of this collection
  /// @dev ERC20 totalSupply() is equal to allTokens.length
  uint16[] public allTokens;

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

  /// @dev Enables operator approvals,
  ///      allowing to use `approve` and `setApprovalForAll` functions
  uint32 public constant FEATURE_OPERATOR_APPROVALS = 0x00000020;

  /// @dev Magic value to be returned upon successful reception of an NFT
  /// @dev Equal to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`,
  ///      which can be also obtained as `ERC721Receiver(0).onERC721Received.selector`
  bytes4 private constant ERC721_RECEIVED = 0x150b7a02;

  /**
   * Supported interfaces section
   */

  /**
   * ERC721 interface definition in terms of ERC165
   *
   * 0x80ac58cd ==
   *   bytes4(keccak256('balanceOf(address)')) ^
   *   bytes4(keccak256('ownerOf(uint256)')) ^
   *   bytes4(keccak256('approve(address,uint256)')) ^
   *   bytes4(keccak256('getApproved(uint256)')) ^
   *   bytes4(keccak256('setApprovalForAll(address,bool)')) ^
   *   bytes4(keccak256('isApprovedForAll(address,address)')) ^
   *   bytes4(keccak256('transferFrom(address,address,uint256)')) ^
   *   bytes4(keccak256('safeTransferFrom(address,address,uint256)')) ^
   *   bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)'))
   */
  bytes4 private constant InterfaceId_ERC721 = 0x80ac58cd;

  /**
   * ERC721 interface extension – exists(uint256)
   *
   * 0x4f558e79 == bytes4(keccak256('exists(uint256)'))
   */
  bytes4 private constant InterfaceId_ERC721Exists = 0x4f558e79;

  /**
   * ERC721 interface extension - ERC721Enumerable
   *
   * 0x780e9d63 ==
   *   bytes4(keccak256('totalSupply()')) ^
   *   bytes4(keccak256('tokenOfOwnerByIndex(address,uint256)')) ^
   *   bytes4(keccak256('tokenByIndex(uint256)'))
   */
  bytes4 private constant InterfaceId_ERC721Enumerable = 0x780e9d63;

  /**
   * ERC721 interface extension - ERC721Metadata
   *
   * 0x5b5e139f ==
   *   bytes4(keccak256('name()')) ^
   *   bytes4(keccak256('symbol()')) ^
   *   bytes4(keccak256('tokenURI(uint256)'))
   */
  bytes4 private constant InterfaceId_ERC721Metadata = 0x5b5e139f;

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

  /// @notice Card state provider is part of the game protocol
  /// @dev Role ROLE_STATE_LOCK_PROVIDER allows modifying card state
  uint32 public constant ROLE_STATE_LOCK_PROVIDER = 0x00400000;

  /// @dev Event names are self-explanatory:
  /// @dev Fired in mint()
  /// @dev Address `_by` allows to track who created a token
  event Minted(address indexed _by, address indexed _to, uint16 _tokenId);

  /// @dev Fired in transfer(), transferFor(), mint()
  /// @dev When minting a token, address `_from` is zero
  /// @dev ERC20/ERC721 compliant event
  event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId, uint256 _value);

  /// @dev Fired in approve(), approveToken()
  /// @dev ERC20/ERC721 compliant event
  event Approval(address indexed _owner, address indexed _spender, uint256 indexed _tokenId, uint256 _value);

  /// @dev Fired when an operator is enabled or disabled for an owner.
  ///      The operator can manage all tokens of the owner.
  /// @dev ERC721 compliant event
  event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);

  /// @dev Fired in setState(), addStateAttributes(), removeStateAttributes()
  event StateModified(address indexed _by, address indexed _owner, uint256 indexed _tokenId, uint128 _state);

  /// @dev Fired in setAttributes(), addAttributes(), removeAttributes()
  event AttributesModified(address indexed _by, address indexed _owner, uint256 indexed _tokenId, uint64 _attributes);

  /// @dev Fired in setLockedBitmask()
  event StateLockModified(address indexed _by, uint128 _bitmask);

  /// @dev Creates a Character Card ERC721 instance,
  /// @dev Registers a ERC721 interface using ERC165
  constructor() public {
    // register the supported interfaces to conform to ERC721 via ERC165
    _registerInterface(InterfaceId_ERC721);
    _registerInterface(InterfaceId_ERC721Exists);
    _registerInterface(InterfaceId_ERC721Enumerable);
    _registerInterface(InterfaceId_ERC721Metadata);
  }

  /**
   * @dev Gets a card by ID, representing it as two integers.
   *      The two integers are tightly packed with a card data:
   *      First integer (high bits) contains (from higher to lower bits order):
   *          attributesModified,
   *          attributes,
   *          stateModified,
   *          state
   *      Second integer (low bits) contains (from higher to lower bits order):
   *          creationTime,
   *          id,
   *          index,
   *          ownershipModified,
   *          owner
   * @dev Throws if card doesn't exist
   * @param _tokenId ID of the card to fetch
   */
  function getPacked(uint256 _tokenId) public constant returns(uint256, uint256) {
    // validate token existence
    require(exists(_tokenId));

    // load the card from storage
    Card memory card = cards[_tokenId];

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
   * @dev Allows to fetch collection of tokens, including internal token data
   *       in a single function, useful when connecting to external node like INFURA
   * @dev Includes token attributes (lower 16 bits) as an internal data
   * @param owner an address to query a collection for
   * @return an array of token IDs packed with their attributes
   */
  function getPackedCollection(address owner) public constant returns (uint32[]) {
    // get an array of Gem IDs owned by an `owner` address
    uint16[] memory tokenIds = getCollection(owner);

    // how many gems are there in a collection
    uint16 balance = uint16(tokenIds.length);

    // data container to store the result
    uint32[] memory result = new uint32[](balance);

    // fetch token info one by one and pack into structure
    for(uint16 i = 0; i < balance; i++) {
      // token ID to work with
      uint16 tokenId = tokenIds[i];
      // get the token attributes and pack them together with tokenId
      uint16 attributes = uint16(getAttributes(tokenId));

      // pack the data
      result[i] = uint32(tokenId) << 16 | attributes;
    }

    // return the packed data structure
    return result;
  }

  /**
   * @notice Retrieves a collection of tokens owned by a particular address
   * @notice An order of token IDs is not guaranteed and may change
   *      when a token from the list is transferred
   * @param owner an address to query a collection for
   * @return an ordered list of tokens
   */
  function getCollection(address owner) public constant returns(uint16[]) {
    // read a collection from mapping and return
    return collections[owner];
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
    // check that the call is made by a state lock provider
    require(__isSenderInRole(ROLE_STATE_LOCK_PROVIDER));

    // update the locked bitmask
    lockedBitmask = bitmask;

    // fire an event
    emit StateLockModified(msg.sender, bitmask);
  }

  /**
   * @dev Gets the state of a card
   * @param _tokenId ID of the card to get state for
   * @return a card state
   */
  function getState(uint256 _tokenId) public constant returns(uint128) {
    // validate token existence
    require(exists(_tokenId));

    // obtain card's state and return
    return cards[_tokenId].state;
  }

  /**
   * @dev Sets the state of a card
   * @dev Requires sender to have `ROLE_COMBAT_PROVIDER` permission
   * @param _tokenId ID of the card to set state for
   * @param state new state to set for the card
   */
  function setState(uint256 _tokenId, uint128 state) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // check that card to set state for exists
    require(exists(_tokenId));

    // set state modified timestamp
    cards[_tokenId].stateModified = uint32(block.number);

    // set the state required
    cards[_tokenId].state = state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit StateModified(msg.sender, ownerOf(_tokenId), _tokenId, state);
  }

  /**
   * @dev Adds state attributes to a card
   * @dev Preserves all previously set state attributes
   * @param _tokenId ID of the card to add state attributes to
   * @param state bitmask representing card state attributes to add
   */
  function addStateAttributes(uint256 _tokenId, uint128 state) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // check that card to add state attributes for exists
    require(exists(_tokenId));

    // set state modified timestamp
    cards[_tokenId].stateModified = uint32(block.number);

    // add the state attributes required
    cards[_tokenId].state |= state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[_tokenId];`
    //cards[_tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit StateModified(msg.sender, ownerOf(_tokenId), _tokenId, cards[_tokenId].state);
  }

  /**
   * @dev Removes state attributes from a card
   * @dev Preserves all the state attributes which are not specified by `state`
   * @param _tokenId ID of the card to remove state attributes from
   * @param state bitmask representing card state attributes to remove
   */
  function removeStateAttributes(uint256 _tokenId, uint128 state) public {
    // check that the call is made by a combat provider
    require(__isSenderInRole(ROLE_STATE_PROVIDER));

    // check that card to remove state attributes from exists
    require(exists(_tokenId));

    // set state modified timestamp
    cards[_tokenId].stateModified = uint32(block.number);

    // add the state attributes required
    cards[_tokenId].state &= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF ^ state;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit StateModified(msg.sender, ownerOf(_tokenId), _tokenId, cards[_tokenId].state);
  }

  /**
   * @dev Gets attributes of a card
   * @param _tokenId ID of the card to get attributes for
   * @return a card attributes bitmask
   */
  function getAttributes(uint256 _tokenId) public constant returns(uint64) {
    // validate token existence
    require(exists(_tokenId));

    // read the attributes and return
    return cards[_tokenId].attributes;
  }

  /**
   * @dev Sets attributes of a card
   * @dev Erases all previously set attributes
   * @param _tokenId ID of the card to set attributes for
   * @param attributes bitmask representing card attributes to set
   */
  function setAttributes(uint256 _tokenId, uint64 attributes) public {
    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // check that card to set attributes for exists
    require(exists(_tokenId));

    // set attributes modified timestamp
    cards[_tokenId].attributesModified = uint32(block.number);

    // set the attributes required
    cards[_tokenId].attributes = attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[_tokenId];`
    //cards[_tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit AttributesModified(msg.sender, ownerOf(_tokenId), _tokenId, cards[_tokenId].attributes);
  }

  /**
   * @dev Adds attributes to a card
   * @dev Preserves all previously set attributes
   * @param _tokenId ID of the card to add attributes to
   * @param attributes bitmask representing card attributes to add
   */
  function addAttributes(uint256 _tokenId, uint64 attributes) public {
    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // check that card to add attributes for exists
    require(exists(_tokenId));

    // set attributes modified timestamp
    cards[_tokenId].attributesModified = uint32(block.number);

    // add the attributes required
    cards[_tokenId].attributes |= attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit AttributesModified(msg.sender, ownerOf(_tokenId), _tokenId, cards[_tokenId].attributes);
  }

  /**
   * @dev Removes attributes from a card
   * @dev Preserves all the attributes which are not specified by `attributes`
   * @param _tokenId ID of the card to remove attributes from
   * @param attributes bitmask representing card attributes to remove
   */
  function removeAttributes(uint256 _tokenId, uint64 attributes) public {
    // check that the call is made by a attributes provider
    require(__isSenderInRole(ROLE_ATTR_PROVIDER));

    // check that card to remove attributes for exists
    require(exists(_tokenId));

    // set attributes modified timestamp
    cards[_tokenId].attributesModified = uint32(block.number);

    // add the attributes required
    cards[_tokenId].attributes &= 0xFFFFFFFFFFFFFFFF ^ attributes;

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire an event
    emit AttributesModified(msg.sender, ownerOf(_tokenId), _tokenId, cards[_tokenId].attributes);
  }

  /**
   * @notice Total number of existing tokens (tracked by this contract)
   * @return A count of valid tokens tracked by this contract,
   *    where each one of them has an assigned and
   *    queryable owner not equal to the zero address
   */
  function totalSupply() public constant returns (uint256) {
    // read the length of the `allTokens` collection
    return allTokens.length;
  }

  /**
   * @notice Enumerate valid tokens
   * @dev Throws if `_index` >= `totalSupply()`.
   * @param _index a counter less than `totalSupply()`
   * @return The token ID for the `_index`th token, unsorted
   */
  function tokenByIndex(uint256 _index) public constant returns (uint256) {
    // out of bounds check
    require(_index < allTokens.length);

    // get the token ID and return
    return allTokens[_index];
  }

  /**
   * @notice Enumerate tokens assigned to an owner
   * @dev Throws if `_index` >= `balanceOf(_owner)`.
   * @param _owner an address of the owner to query token from
   * @param _index a counter less than `balanceOf(_owner)`
   * @return the token ID for the `_index`th token assigned to `_owner`, unsorted
   */
  function tokenOfOwnerByIndex(address _owner, uint256 _index) public constant returns (uint256) {
    // out of bounds check
    require(_index < collections[_owner].length);

    // get the token ID from owner collection and return
    return collections[_owner][_index];
  }

  /**
   * @notice Gets an amount of tokens owned by the given address
   * @dev Gets the balance of the specified address
   * @param _owner address to query the balance for
   * @return an amount owned by the address passed as an input parameter
   */
  function balanceOf(address _owner) public constant returns (uint256) {
    // read the length of the `_owner`s collection of tokens
    return collections[_owner].length;
  }

  /**
   * @notice Checks if specified token exists
   * @dev Returns whether the specified token ID exists
   * @param _tokenId ID of the token to query the existence for
   * @return whether the token exists (true - exists)
   */
  function exists(uint256 _tokenId) public constant returns (bool) {
    // check if this token exists (owner is not zero)
    return cards[_tokenId].owner != address(0);
  }

  /**
   * @notice Finds an owner address for a token specified
   * @dev Gets the owner of the specified token from the `cards` mapping
   * @dev Throws if a token with the ID specified doesn't exist
   * @param _tokenId ID of the token to query the owner for
   * @return owner address currently marked as the owner of the given card
   */
  function ownerOf(uint256 _tokenId) public constant returns (address) {
    // validate token existence
    require(exists(_tokenId));

    // return card's owner (address)
    return cards[_tokenId].owner;
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
    // check if caller has sufficient permissions to mint a card
    require(__isSenderInRole(ROLE_TOKEN_CREATOR));

    // validate destination address
    require(to != address(0));
    require(to != address(this));

    // delegate call to `__mint`
    __mint(to, tokenId, rarity);

    // fire ERC20 transfer event
    emit Transfer(address(0), to, tokenId, 1);
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
    // check if caller has sufficient permissions to mint a card
    require(__isSenderInRole(ROLE_TOKEN_CREATOR));

    // validate destination address
    require(to != address(0));
    require(to != address(this));

    // how many cards we're minting
    uint16 n = uint16(data.length);

    // there should be at least one card to mint
    // also check we didn't get uint16 overflow in `n`
    require(n != 0 && n == data.length);

    // iterate over `data` array and mint each card specified
    for(uint256 i = 0; i < n; i++) {
      // unpack card from data element
      // and delegate call to `__mint`
      __mint(to, uint16(data[i] >> 8), uint8(data[i]));
    }

    // fire ERC20 transfer event
    emit Transfer(address(0), to, 0, n);
  }

  /**
   * @notice Supports both ERC20 and ERC721 modes of operation,
   *      depending on the `_value` being passed:
   *      ERC721 mode is enabled if it is greater then `RESERVED_TOKEN_ID_SPACE`
   *      and the value passed is treated to be a token ID
   * @notice For ERC721 mode see `transferToken`
   *
   * @notice Transfers ownership rights of `_value` *arbitrary* tokens
   *      to a new owner specified by address `_to`
   * @dev The tokens are taken from the end of the owner's token collection
   * @dev Requires the sender of the transaction to be an owner
   *      of at least `_value` tokens
   * @dev For security reasons this function will throw if transferring
   *      less tokens than is owned by the sender (`_value != balanceOf(msg.sender)`) -
   *      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
   * @dev Consumes around 38521 + 511735 * (`_value` / 16) gas for `_value` multiple of 16
   * @dev ERC20 compliant transfer(address, uint256)
   * @dev ERC721 compliant transfer(address, uint256)
   * @param _to an address where to transfer tokens to,
   *        new owner of the tokens
   * @param _value number of tokens to transfer
   */
  function transfer(address _to, uint256 _value) public returns (bool success) {
    // determine if `_value` represents a token ID (ERC721)
    // or an amount of tokens to be transferred (ERC20)
    if(_value > RESERVED_TOKEN_ID_SPACE) {
      // _value should be treated as token ID
      // the call was intended to be a ERC721 transfer

      // check that `_tokenId` is inside valid bounds
      // and cast it to uint16, we don't need more bits anymore
      uint16 tokenId = checkBounds(_value);

      // delegate call to `transferToken`
      transferToken(_to, tokenId);

      // don't forget to return after successful transfer
      return true;
    }

    // check if ERC20 transfers feature is enabled
    require(__isFeatureEnabled(ERC20_TRANSFERS));

    // delegate call to unsafe `__transfer`
    __transfer(msg.sender, _to, _value);

    // the function always succeeds,
    // if an error occurred - we have already thrown
    return true;
  }

  /**
   * @notice Supports both ERC20 and ERC721 modes of operation,
   *      depending on the `_value` being passed:
   *      ERC721 mode is enabled if it is greater then `RESERVED_TOKEN_ID_SPACE`
   *      and the value passed is treated to be a token ID
   * @notice For ERC721 mode see `transferTokenFrom`
   *
   * @notice A.k.a "transfer on behalf"
   * @notice Transfers ownership rights of `_value` *arbitrary* tokens
   *      to a new owner specified by address `_to`
   * @dev The tokens are taken from the end of the owner's token collection
   * @dev Requires the sender of the transaction to be authorized
   *      to "spend" at least `_value` tokens
   * @dev The sender is granted an authorization to "spend" the tokens
   *      by the owner of the tokens using `approve` function
   * @dev For security reasons this function will throw if transferring
   *      less tokens than is owned by an owner (`_value != balanceOf(_from)`) -
   *      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
   * @dev ERC20 compliant transferFrom(address, address, uint256)
   * @dev ERC721 compliant transferFrom(address, address, uint256)
   * @param _from an address from where to take tokens from,
   *        current owner of the tokens
   * @param _to an address where to transfer tokens to,
   *        new owner of the tokens
   * @param _value number of tokens to transfer
   */
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
    // determine if `_value` represents a token ID (ERC721)
    // or an amount of tokens to be transferred (ERC20)
    if(_value > RESERVED_TOKEN_ID_SPACE) {
      // _value should be treated as token ID
      // the call was intended to be a ERC721 transfer

      // check that `_value` is inside valid bounds
      // and cast it to uint16, we don't need more bits anymore
      uint16 tokenId = checkBounds(_value);

      // delegate call to `transferTokenFrom`
      transferTokenFrom(_from, _to, tokenId);

      // don't forget to return after successful transfer
      return true;
    }

    // check if ERC20 transfers on behalf feature is enabled
    require(__isFeatureEnabled(ERC20_TRANSFERS_ON_BEHALF));

    // call sender gracefully - `operator`
    address operator = msg.sender;

    // we assume `from` has at least `_value` tokens to transfer,
    // this will be explicitly checked in `__transfer`

    // fetch how much approvals left for an operator
    uint256 approvalsLeft = allowance[_from][operator];

    // operator must be approved to transfer `_value` tokens on behalf
    // otherwise this is equal to regular transfer,
    // where `from` is basically a transaction sender and owner of the tokens
    if(approvalsLeft < _value) {
      // transaction sender doesn't have required amount of approvals left
      // we will treat him as an owner trying to send his own tokens
      // try to perform regular ERC20 transfer

      // check if ERC20 transfers feature is enabled
      require(__isFeatureEnabled(ERC20_TRANSFERS));

      // check `from` to be `operator` (transaction sender):
      require(_from == operator);
    }
    else {
      // update operator's approvals left + emit an event
      __decreaseOperatorApprovalsLeft(_from, operator, _value);
    }

    // delegate call to unsafe `__transfer`
    __transfer(_from, _to, _value);

    // the function always succeeds,
    // if an error occurred - we have already thrown
    return true;
  }

  /**
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @dev Requires the sender of the transaction to be an owner
   *      of the token specified (`tokenId`)
   * @param to new owner address
   * @param _tokenId ID of the token to transfer ownership rights for
   */
  function transferToken(address to, uint256 _tokenId) public {
    // check if token transfers feature is enabled
    require(__isFeatureEnabled(FEATURE_TRANSFERS));

    // delegate call to unsafe `__transferToken`
    __transferToken(msg.sender, to, _tokenId);
  }

  /**
   * @notice A.k.a "transfer a token on behalf"
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @notice Allows transferring ownership rights by a trading operator
   *      on behalf of token owner. Allows building an exchange of tokens.
   * @notice THE CALLER IS RESPONSIBLE TO CONFIRM THAT `_to`
   *         IS CAPABLE OF RECEIVING TOKEN OR ELSE IT MAY BE PERMANENTLY LOST
   * @dev Transfers the ownership of a given token ID to another address
   * @dev Requires the transaction sender to be the owner, approved, or operator
   * @dev Requires from to be an owner of the token
   * @param from current owner of the token
   * @param to address to receive the ownership of the token
   * @param _tokenId ID of the token to be transferred
   */
  function transferTokenFrom(address from, address to, uint256 _tokenId) public {
    // check if token transfers on behalf feature is enabled
    require(__isFeatureEnabled(FEATURE_TRANSFERS_ON_BEHALF));

    // call sender gracefully - `operator`
    address operator = msg.sender;

    // find if an approved address exists for this token
    address approved = approvals[_tokenId];

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

      // check if token transfers feature is enabled
      require(__isFeatureEnabled(FEATURE_TRANSFERS));

      // check `from` to be `operator` (transaction sender):
      require(from == operator);
    }

    // delegate call to unsafe `__transferToken`
    __transferToken(from, to, _tokenId);
  }

  /**
   * @notice A.k.a "safe transfer a token on behalf"
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @notice Allows transferring ownership rights by a trading operator
   *      on behalf of token owner. Allows building an exchange of tokens.
   * @dev Safely transfers the ownership of a given token ID to another address
   * @dev Requires the transaction sender to be the owner, approved, or operator
   * @dev When transfer is complete, this function
   *      checks if `_to` is a smart contract (code size > 0). If so, it calls
   *      `onERC721Received` on `_to` and throws if the return value is not
   *      `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`.
   * @param _from current owner of the token
   * @param _to address to receive the ownership of the token
   * @param _tokenId ID of the token to be transferred
   * @param _data Additional data with no specified format, sent in call to `_to`
   */
  function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes _data) public {
    // delegate call to usual (unsafe) `transferTokenFrom`
    transferTokenFrom(_from, _to, _tokenId);

    // check if receiver `_to` supports ERC721 interface
    if (AddressUtils.isContract(_to)) {
      // if `_to` is a contract – execute onERC721Received
      bytes4 response = ERC721Receiver(_to).onERC721Received(msg.sender, _from, _tokenId, _data);

      // expected response is ERC721_RECEIVED
      require(response == ERC721_RECEIVED);
    }
  }

  /**
   * @notice A.k.a "safe transfer a token on behalf"
   * @notice Transfers ownership rights of a token defined
   *      by the `tokenId` to a new owner specified by address `to`
   * @notice Allows transferring ownership rights by a trading operator
   *      on behalf of token owner. Allows building an exchange of tokens.
   * @dev Safely transfers the ownership of a given token ID to another address
   * @dev Requires the transaction sender to be the owner, approved, or operator
   * @dev Requires from to be an owner of the token
   * @dev If the target address is a contract, it must implement `onERC721Received`,
   *      which is called upon a safe transfer, and return the magic value
   *      `bytes4(keccak256("onERC721Received(address,uint256,bytes)"))`;
   *      otherwise the transfer is reverted.
   * @dev This works identically to the other function with an extra data parameter,
   *      except this function just sets data to "".
   * @param _from current owner of the token
   * @param _to address to receive the ownership of the token
   * @param _tokenId ID of the token to be transferred
   */
  function safeTransferFrom(address _from, address _to, uint256 _tokenId) public {
    // delegate call to overloaded `safeTransferFrom`, set data to ""
    safeTransferFrom(_from, _to, _tokenId, "");
  }

  /**
   * @notice Approves an address to transfer the given token on behalf of its owner
   *      Can also be used to revoke an approval by setting `to` address to zero
   * @dev The zero `to` address revokes an approval for a given token
   * @dev There can only be one approved address per token at a given time
   * @dev This function can only be called by the token owner
   * @param to address to be approved to transfer the token on behalf of its owner
   * @param _tokenId ID of the token to be approved for transfer on behalf
   */
  function approveToken(address to, uint256 _tokenId) public {
    // check if token transfers on behalf feature is enabled
    // we allow approval revokes anyway (if `to` is zero)
    require(__isFeatureEnabled(FEATURE_TRANSFERS_ON_BEHALF) || to == address(0));

    // call sender nicely - `from`
    address from = msg.sender;
    // get token owner address (also ensures that token exists)
    address owner = ownerOf(_tokenId);

    // caller must own this token
    require(from == owner);
    // approval for owner himself is pointless, do not allow
    require(to != owner);
    // either we're removing approval, or setting it
    require(approvals[_tokenId] != address(0) || to != address(0));

    // set an approval (deletes an approval if to == 0)
    approvals[_tokenId] = to;

    // emit ERC20/ERC721 event
    emit Approval(from, to, _tokenId, 1);
  }

  /**
   * @notice Removes an approved address, which was previously added by `approve`
   *      for the given token. Equivalent to calling approve(0, tokenId)
   * @dev Same as calling approve(0, tokenId)
   * @param _tokenId ID of the token to remove approved address for
   */
  function revokeApproval(uint256 _tokenId) public {
    // delegate call to `approve`
    approveToken(address(0), _tokenId);
  }

  /**
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer *all* tokens of the sender on their behalf
   * @param _operator operator address to set the approval for
   * @param _approved representing the status of the approval to be set
   */
  function setApprovalForAll(address _operator, bool _approved) public {
    // set maximum possible approval
    approve(_operator, _approved ? UNLIMITED_APPROVALS : 0);

    // emit an event
    emit ApprovalForAll(msg.sender, _operator, _approved);
  }

  /**
   * @notice Supports both ERC20 and ERC721 modes of operation,
   *      depending on the `_value` being passed:
   *      ERC721 mode is enabled if it is greater then `RESERVED_TOKEN_ID_SPACE`
   *      and the value passed is treated to be a token ID
   * @notice For ERC721 mode see `approveToken`
   *
   * @dev Sets or unsets the approval of a given operator
   * @dev An operator is allowed to transfer up to `_value` tokens of the sender on their behalf
   * @dev ERC20 compliant approve(address, uint256) function
   * @dev ERC721 compliant approve(address, uint256) function
   * @param _approved operator address to set the approval for
   * @param _value representing the number of approvals left to be set
   */
  function approve(address _approved, uint256 _value) public returns (bool success) {
    // determine if `_value` represents a token ID (ERC721)
    // or an amount of tokens to be approved (ERC20)
    if(_value > RESERVED_TOKEN_ID_SPACE) {
      // _value should be treated as token ID
      // the call was intended to be a ERC721 approve

      // check that `_value` is inside valid bounds
      // and cast it to uint16, we don't need more bits anymore
      uint16 tokenId = checkBounds(_value);

      // delegate call to `approveToken`
      approveToken(_approved, tokenId);

      // don't forget to return after successful approve
      return true;
    }

    // check if operator approvals feature is enabled
    // or if ERC20 transfers on behalf feature is enabled
    require(__isFeatureEnabled(FEATURE_OPERATOR_APPROVALS) || __isFeatureEnabled(ERC20_TRANSFERS_ON_BEHALF));

    // call sender nicely - `from`
    address from = msg.sender;

    // validate destination address
    require(_approved != address(0));

    // approval for owner himself is pointless, do not allow
    require(_approved != from);

    // set an approval
    allowance[from][_approved] = _value;

    // emit an ERC20 compliant event
    emit Approval(from, _approved, 0, _value);

    // the function always succeeds,
    // if an error occurred - we have already thrown
    return true;
  }

  /**
   * @notice Get the approved address for a single token
   * @dev Throws if `_tokenId` is not a valid token ID.
   * @param _tokenId ID of the token to find the approved address for
   * @return the approved address for this token, or the zero address if there is none
   */
  function getApproved(uint256 _tokenId) public constant returns (address) {
    // validate token existence
    require(exists(_tokenId));

    // find the number of approvals and return
    return approvals[_tokenId];
  }

  /**
   * @notice Query if an address is an authorized operator for another address
   * @param _owner the address that owns at least one token
   * @param _operator the address that acts on behalf of the owner
   * @return true if `_operator` is an approved operator for `_owner`, false otherwise
   */
  function isApprovedForAll(address _owner, address _operator) public constant returns (bool) {
    // is there a positive amount of approvals left
    return allowance[_owner][_operator] > 0;
  }

  /**
   * @notice A distinct Uniform Resource Identifier (URI) for a given asset.
   * @dev Throws if `_tokenId` is not a valid token ID.
   *      URIs are defined in RFC 3986.
   * @param _tokenId uint256 ID of the token to query
   * @return token URI
   */
  function tokenURI(uint256 _tokenId) public constant returns (string) {
    // validate token existence
    require(exists(_tokenId));

    // token URL consists of base URL part (domain) and token ID
    return StringUtils.concat("http://etherthrone.io/card/", StringUtils.itoa(_tokenId, 16));
  }

  /**
   * @dev Checks if token ID `_tokenId` specified lays within valid token ID bounds:
   *      * is not outside valid token ID space `TOKEN_ID_SPACE`
   *      * doesn't lay inside reserved token ID space `RESERVED_TOKEN_ID_SPACE`
   * @dev Tokens with valid IDs can be minted while all other IDs cannot exist
   *      within this smart contract
   * @dev Throws if token ID is out of bounds
   * @param _tokenId a token ID to check
   * @return same value as an input, represented as uint16
   */
  function checkBounds(uint256 _tokenId) private pure returns(uint16 tokenId) {
    // check if token ID is not in reserved token ID space,
    // and is not outside token ID space
    require(_tokenId > RESERVED_TOKEN_ID_SPACE && _tokenId == _tokenId & TOKEN_ID_SPACE);

    // set the normalized `tokenId`
    tokenId = uint16(_tokenId);

    // overflow check, cannot be unmet by design
    assert(tokenId == _tokenId);
  }

  /// @dev Creates new card with `tokenId` ID specified and
  ///      assigns an ownership `to` for this card
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call
  ///      checks only that the card doesn't exist yet
  /// @dev Must be kept private at all times
  function __mint(address to, uint16 tokenId, uint8 rarity) private {
    // check that `_tokenId` is inside valid bounds
    tokenId = checkBounds(tokenId);

    // ensure that token with such ID doesn't exist
    require(!exists(tokenId));

    // create a new card in memory
    Card memory card = Card({
      attributesModified: 0,
      attributes: uint64(1 << uint256(rarity)) - 1,
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

    // add token ID to the `allTokens` collection,
    // automatically updates total supply
    allTokens.push(tokenId);

    // fire Minted event
    emit Minted(msg.sender, to, tokenId);
    // fire ERC721 transfer event
    emit Transfer(address(0), to, tokenId, 0);
  }

  /// @dev Performs a transfer of `n` tokens from address `from` to address `to`
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call;
  ///      checks only that address `from` has at least `n` tokens on the balance
  /// @dev For security reasons this function throws if transferring
  ///      less tokens than is owned by an owner (`n != balanceOf(from)`) -
  ///      as long as feature `ERC20_INSECURE_TRANSFERS` is not enabled
  /// @dev Is save to call from `transfer(to, n)` since it doesn't need any additional checks
  /// @dev Must be kept private at all times
  function __transfer(address from, address to, uint256 n) private {
    // validate source and destination address
    require(to != address(0));
    require(to != from);

    // impossible by design of transfer(), transferFrom() and approve()
    // if it happens - its a bug
    assert(from != address(0));

    // for security reasons we require `n` to be within `RESERVED_TOKEN_ID_SPACE`
    // otherwise it can mean an attempt to transfer a particular token (not `n` tokens)
    // n cannot be equal to RESERVED_TOKEN_ID_SPACE by design:
    // token IDs start from RESERVED_TOKEN_ID_SPACE + 1, while there can be no more then
    // RESERVED_TOKEN_ID_SPACE - 1 tokens within this smart contract
    require(n > 0 && n < RESERVED_TOKEN_ID_SPACE);

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
    emit Transfer(from, to, 0, n);
  }

  /// @dev Performs a transfer of a token `tokenId` from address `from` to address `to`
  /// @dev Unsafe: doesn't check if caller has enough permissions to execute the call;
  ///      checks only for token existence and that ownership belongs to `from`
  /// @dev Is save to call from `transferToken(to, tokenId)` since it doesn't need any additional checks
  /// @dev Must be kept private at all times
  function __transferToken(address from, address to, uint256 _tokenId) private {
    // validate source and destination address
    require(to != address(0));
    require(to != from);
    // impossible by design of transferToken(), transferTokenFrom(),
    // approveToken() and approve()
    assert(from != address(0));

    // get the card pointer to the storage
    Card storage card = cards[_tokenId];

    // validate token existence
    require(exists(_tokenId));

    // validate token ownership
    require(card.owner == from);

    // transfer is not allowed for a locked card
    // (ex.: if card is currently in game/battle)
    require(card.state & lockedBitmask == 0);

    // clear approved address for this particular token + emit event
    __clearApprovalFor(_tokenId);

    // move card ownership,
    // update old and new owner's card collections accordingly
    __moveToken(from, to, _tokenId);

    // persist card back into the storage
    // this may be required only if cards structure is loaded into memory, like
    // `Card memory card = cards[tokenId];`
    //cards[tokenId] = card; // uncomment if card is in memory (will increase gas usage!)

    // fire a ERC20/ERC721 transfer event
    emit Transfer(from, to, _tokenId, 1);
  }

  /// @dev Clears approved address for a particular token
  function __clearApprovalFor(uint256 _tokenId) private {
    // check if approval exists - we don't want to fire an event in vain
    if(approvals[_tokenId] != address(0)) {
      // clear approval
      delete approvals[_tokenId];

      // emit ERC20/ERC721 event
      emit Approval(msg.sender, address(0), _tokenId, 0);
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
      emit Approval(owner, operator, 0, approvalsLeft);
    }
  }

  /// @dev Move `n` the tokens from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __move(address from, address to, uint256 n) private {
    // get a reference to the `from` collection
    uint16[] storage source = collections[from];

    // get a reference to the `to` collection
    uint16[] storage destination = collections[to];

    // `source` and `destination` arrays size is limited to uint16 space
    assert(source.length < 65536);
    assert(destination.length < 65536);

    // check `n` is in safe bounds
    require(n <= source.length);

    // initial position of the tokens to be moved in `destination` array
    uint256 offset = destination.length;

    // copy last `n` tokens from `source` to `destination`
    for(uint256 i = source.length - n; i < source.length; i++) {
      // get the link to a card from the source collection
      Card storage card = cards[source[i]];

      // cardId must be consistent with the collections by design
      // otherwise this is a bug
      assert(source[i] == card.id);

      // moving a card is not allowed for a locked card
      // (ex.: if card is currently in game/battle)
      require(card.state & lockedBitmask == 0);

      // update card index to position in `destination` collection
      card.index = uint16(offset + i);

      // update card owner
      card.owner = to;

      // update ownership transfer date
      card.ownershipModified = uint32(block.number);

      // write the card to destination collection
      destination.push(source[i]);

      // emit ERC721 transfer event
      emit Transfer(from, to, source[i], 0);
    }

    // trim source (`from`) collection array by `n`
    source.length -= n;
  }

  /// @dev Move token defined by `tokenId` from owner `from` to a new owner `to`
  /// @dev Unsafe, doesn't check for consistence
  /// @dev Must be kept private at all times
  function __moveToken(address from, address to, uint256 _tokenId) private {
    // cast token ID to uint16 space
    uint16 tokenId = uint16(_tokenId);

    // overflow check, failure impossible by design of mint()
    assert(tokenId == _tokenId);

    // load card from storage
    Card storage card = cards[_tokenId];

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
    uint16 sourceId = source[source.length - 1];

    // update card index to point to proper place in the collection `source`
    cards[sourceId].index = i;

    // put it into the position i within `source`
    source[i] = sourceId;

    // trim the collection `source` by removing last element
    source.length--;

    // update card index according to position in new collection `destination`
    card.index = uint16(destination.length);

    // update card owner
    card.owner = to;

    // update ownership transfer date
    card.ownershipModified = uint32(block.number);

    // push card into collection
    destination.push(tokenId);
  }

}
