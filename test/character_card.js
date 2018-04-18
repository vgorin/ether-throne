// role constants copied from CharacterCard.sol as is
const ROLE_CARD_CREATOR = 0x00000001;
const ROLE_COMBAT_PROVIDER = 0x00000002;
const ROLE_EXCHANGE = 0x00000004;
const ROLE_ROLE_MANAGER = 0x00000008;

const CharacterCard = artifacts.require("./CharacterCard.sol");

// used only for overloaded shadowed functions
// more info: https://beresnev.pro/test-overloaded-solidity-functions-via-truffle/
const web3Abi = require('web3-eth-abi');

contract('CharacterCard', function(accounts) {
	it("initial state", async function() {
		const card = await CharacterCard.new();
		assert.equal(0, await card.totalSupply(), "initial totalSupply must be zero");
		assert.equal(0, await card.balanceOf(accounts[0]), "initial card balance must be zero");
		assert(!await card.exists(0x1), "card 0x1 should not exist initially");
		await assertThrowsAsync(async function() {await card.ownerOf(0x1);});
	});

	it("roles: add an operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		assert(await card.isOperator(accounts[1]), accounts[1] + " must be an operator but its not");
	});
	it("roles: operator adds another operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER | 0x1);
		await card.addOperator.sendTransaction(accounts[2], 0x1, {from: accounts[1]});
		assert(await card.isOperator(accounts[2]), accounts[2] + " must be an operator but its not");
	});
	it("roles: remove operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		assert(await card.isOperator(accounts[1]), accounts[1] + " must be an operator but its not");
		await card.removeOperator(accounts[1]);
		assert(!await card.isOperator(accounts[1]), accounts[1] + " must not be an operator but it is");
	});
	it("roles: operator removes another operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], 0x1);
		assert(await card.isOperator(accounts[2]), accounts[2] + " must be an operator but its not");
		await card.removeOperator.sendTransaction(accounts[2], {from: accounts[1]});
		assert(!await card.isOperator(accounts[2]), accounts[2] + " must not be an operator but it is");
	});
	it("roles: impossible to add more powerful operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: account[1]});
		});
	});
	it("roles: adding an operator requires ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		});
	});
	it("roles: removing operator requires ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.removeOperator.sendTransaction(accounts[2], {from: accounts[1]});
		});
	});
	it("roles: impossible to add an operator without permissions", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addOperator(accounts[1], 0);});
	});
	it("roles: impossible to remove non-existing operator", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.removeOperator(accounts[1]);});
	});
	it("roles: impossible to add operator which already exists", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addOperator(accounts[0], 0x1);});
	});
	it("roles: ROLE_CARD_SELLER role is enough to mint a card", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.mint.sendTransaction(0x1, accounts[1], {from: accounts[1]});
		assert.equal(1, await card.totalSupply(), "card was not minted, totalSupply is not 1");
		assert.equal(1, await card.balanceOf(accounts[1]), "card was not minted, balanceOf " + accounts[1] + " is not 1");
		assert(await card.exists(0x1), "card was not minted, card 0x1 doesn't exist");
	});

	it("permissions: add role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addRole(accounts[1], ROLE_COMBAT_PROVIDER);
		assert(await card.isUserInRole(accounts[1], ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER was not added");
	});
	it("permissions: remove role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_COMBAT_PROVIDER);
		assert(await card.isUserInRole(accounts[1], ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER must be enabled initially");
		await card.removeRole(accounts[1], ROLE_COMBAT_PROVIDER);
		assert(!await card.isUserInRole(accounts[1], ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER was not removed");
	});
	it("permissions: impossible to add role without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addOperator(accounts[2], ROLE_COMBAT_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		});
	});
	it("permissions: add role using ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_COMBAT_PROVIDER);
		await card.addRole.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		assert(card.isUserInRole(accounts[2], ROLE_CARD_CREATOR), "role ROLE_CARD_CREATOR was not added");
	});
	it("permissions: impossible to add role using user without same role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_COMBAT_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: impossible to add role to non-existing operator", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addRole(accounts[1], 0x1);});
	});
	it("permissions: impossible to remove last role leaving operator without any permissions", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.removeRole(accounts[1], 0x1);});
	});

	it("mint: mint a card", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		assert.equal(1, await card.totalSupply(), "totalSupply after minting a card must be 1");
		assert.equal(1, await card.balanceOf(accounts[0]), "card balance after minting a card must be 1");
		assert(await card.exists(0x1), "card 0x1 should exist after minting");
		assert.equal(accounts[0], await card.ownerOf(0x1), "card 0x1 has wrong owner after minting it to " + accounts[0]);
	});
	it("mint: impossible to mint the same card twice", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await assertThrowsAsync(async function() {await card.mint(0x1, accounts[0]);});
	});
	it("mint: impossible to mint a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(0x1, 0);});
	});
	it("mint: impossible to mint a card without appropriate permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint.sendTransaction(0x1, accounts[1], {from: accounts[1]});});
	});

	it("transfer: transfer a card", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.transfer(accounts[1], 0x1);
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x1), "card 0x1 has wrong owner after transferring it to " + accounts[1]);
	});
	it("transfer: impossible to transfer a card which you do not own", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[1]);
		await assertThrowsAsync(async function() {await card.transfer(accounts[2], 0x1);});
	});
	it("transfer: impossible to transfer a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await assertThrowsAsync(async function() {await card.transfer(0, 0x1);});
	});
	it("transfer: impossible to transfer a card to oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await assertThrowsAsync(async function() {await card.transfer(accounts[0], 0x1);});
	});
	it("transfer: approval revokes after card transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[2], 0x1);
		await card.transfer(accounts[1], 0x1);
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer")
	});

	it("transferFrom: transfer own card without any approvals", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.transferFrom(accounts[0], accounts[1], 0x1);
		assert.equal(accounts[1], await card.ownerOf(0x1), "card 0x1 has wrong owner after transferring it");
	});
	it("transferFrom: transfer a card on behalf (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[1], 0x1);
		await card.transferFrom.sendTransaction(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x1), "wrong card 0x1 owner after transferring to " + accounts[1]);
	});
	it("transferFrom: transfer a card on behalf (operator approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approveForAll(accounts[1], 1);
		await card.transferFrom(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(accounts[1], await card.ownerOf(0x1), "wrong card 0x1 owner after transferring to " + accounts[1]);
	});
	it("transferFrom: transfer a card on behalf (both single card and operator approvals)", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[1], 0x1);
		await card.approveForAll(accounts[1], 1);
		await card.transferFrom(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer")
	});
	it("transferFrom: impossible to transfer card on behalf without approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await assertThrowsAsync(async function() {
			await card.transferFrom.sendTransaction(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		});
	});
	it("transferFrom: operator approval can be exhausted (spent)", async function() {
		const card = await CharacterCard.new();
		await card.approveForAll(accounts[0], 1, {from: accounts[1]});
		assert.equal(1, await card.operators(accounts[1], accounts[0]), "wrong approval left value after it was set to 1");
		await card.mint(0x1, accounts[1]);
		await card.mint(0x2, accounts[1]);
		await card.transferFrom(accounts[1], accounts[0], 0x1);
		assert.equal(0, await card.operators(accounts[1], accounts[0]), "wrong approval left value after transfer on behalf");
		await assertThrowsAsync(async function() {await card.transferFrom(accounts[1], accounts[0], 0x2);});
	});
	it("transferFrom: approval revokes after card transfer on behalf", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[2], 0x1);
		await card.transferFrom(accounts[0], accounts[1], 0x1, {from: accounts[2]});
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer on behalf")
	});

	it("approve: newly created card is not approved to be transferred initially", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		assert.equal(0, await card.approvals(0x1), "initial approval state for card 0x1 is wrong")
	});
	it("approve: approve an address (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[1], 0x1);
		assert.equal(accounts[1], await card.approvals(0x1), "approval state for card 0x1 is wrong")
	});
	it("approve: revoke an approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.approve(accounts[1], 0x1);
		await card.revokeApproval(0x1);
		assert.equal(0, await card.approvals(0x1), "approval state after revoking for card 0x1 is wrong")
	});
	it("approve: impossible to approve another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[1]);
		await assertThrowsAsync(async function() {await card.approve(accounts[0], 0x1);});
	});
	it("approve: impossible to revoke approval of another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[1]);
		await card.approve.sendTransaction(accounts[0], 0x1, {from: accounts[1]});
		await assertThrowsAsync(async function() {await card.revokeApproval(0x1);});
	});
	it("approve: impossible to approve non-existent card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approve(accounts[1], 0x1);});
	});
	it("approve: impossible to revoke an approval if it doesn't exist", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[1]);
		await assertThrowsAsync(async function() {await card.revokeApproval(0x1);});
	});
	it("approve: impossible to approve oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[1]);
		await assertThrowsAsync(async function() {await card.approve(accounts[0], 0x1);});
	});

	it("approveForAll: create operator", async function() {
		const card = await CharacterCard.new();
		await card.approveForAll(accounts[1], 1);
		assert.equal(1, await card.operators(accounts[0], accounts[1]), "wrong approvals left value after it was set to 1");
	});
	it("approveForAll: create an operator with unlimited approvals", async function() {
		/*
		 * approveForAll(address, bool) is an overloaded function and is shadowed by
		 * approveForAll(address, uint256)
		 *
		 * to call approveForAll(address, bool) which sets approval left to maximum possible uint256
		 * value, we use a trick described here:
		 * https://beresnev.pro/test-overloaded-solidity-functions-via-truffle/
		 */
		// create a card instance
		const cardInstance = await CharacterCard.new();

		// ABI of  approveForAll(address to, bool approved)
		const overloadedApproveForAllAbi = {
			"constant": false,
			"inputs": [
				{
					"name": "to",
					"type": "address"
				},
				{
					"name": "approved",
					"type": "bool"
				}
			],
			"name": "approveForAll",
			"outputs": [],
			"payable": false,
			"stateMutability": "nonpayable",
			"type": "function"
		};
		// encode the real data to the call, like
		// approveForAll(accounts[1], true)
		const approveForAllMethodTransactionData = web3Abi.encodeFunctionCall(
			overloadedApproveForAllAbi,
			[
				accounts[1],
				true
			]
		);

		// send raw transaction data
		await CharacterCard.web3.eth.sendTransaction({from: accounts[0], to: cardInstance.address, data: approveForAllMethodTransactionData, value: 0});

		// check the result is greater then zero
		assert(await cardInstance.operators(accounts[0], accounts[1]) > 0, "approvals left must be greater then zero");

		// check the value set is indeed maximum possible uint256
		assert.equal(
			"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // maximum uint256
			(await cardInstance.operators(accounts[0], accounts[1])).toString(16).toUpperCase(),
			"approvals left must be set to maximum uint256"
		);
	});
	it("approveForAll: impossible to approve oneself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approveForAll(accounts[0], 1);});
	});
});

async function assertThrowsAsync(fn) {
	let f = function() {};
	try {
		await fn();
	}
	catch(e) {
		f = function() {
			throw e;
		};
	}
	finally {
		assert.throws(f);
	}
}
