// role constants copied from CharacterCard.sol as is
const ROLE_CARD_CREATOR = 0x00000001;
const ROLE_COMBAT_PROVIDER = 0x00000002;
const ROLE_EXCHANGE = 0x00000004;
const ROLE_ROLE_MANAGER = 0x00000008;

const CharacterCard = artifacts.require("./CharacterCard.sol");

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
