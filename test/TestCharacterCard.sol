pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/CharacterCard.sol";

contract TestCharacterCard {
  function testInitialState() public {
    CharacterCard card = CharacterCard(DeployedAddresses.CharacterCard());

    Assert.equal(card.totalSupply, 0, "initial totalSupply must be zero");
  }
}
