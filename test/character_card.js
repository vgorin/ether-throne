const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard', function(accounts) {
	it("initial state", async function() {
		const card = await CharacterCard.new();
		assert.equal(0, await card.totalSupply(), "initial totalSupply must be zero");
		assert.equal(0, await card.balanceOf(accounts[0]), "initial card balance must be zero");
		assert(!await card.exists(0x1), "card 0x1 should not exist initially");
		await assertThrowsAsync(async function() {await card.ownerOf(0x1);});
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
		await assertThrowsAsync(async function() {await card.mint(0x1, accounts[0])});
	});
	it("mint: impossible to mint a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(0x1, 0)});
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
