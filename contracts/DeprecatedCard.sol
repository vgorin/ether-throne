pragma solidity 0.4.23;

/**
 * @dev A character card which has deprecated old version 0,
 *      used only in tests
 */
contract DeprecatedCard {
  /// @dev Smart contract version
  uint32 public constant version = 0x0;

  /// @dev ERC20 compatible token symbol
  string public constant symbol = "ET";
  /// @dev ERC20 compatible token name
  string public constant name = "Character Card - Ether Throne";
  /// @dev ERC20 compatible token decimals
  /// @dev this can be only zero, since ERC721 token is non-fungible
  uint8 public constant decimals = 0;
}
