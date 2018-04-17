const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard', function(accounts) {
	it("initial state", async function() {
		const card = await CharacterCard.new();
		assert.equal(0, await card.totalSupply(), "initial totalSupply must be zero");
		assert.equal(0, await card.balanceOf(accounts[0]), "initial card balance must be zero");
		assert(!await card.exists(0x1), "card 1 should not exist initially");
		await assertThrowsAsync(async function() {await card.ownerOf(0x1);});
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
