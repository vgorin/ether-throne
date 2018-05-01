// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_UNDEFINED = 0;
const GAME_OUTCOME_DEFEAT = 1;
const GAME_OUTCOME_DRAW = 2;
const GAME_OUTCOME_VICTORY = 3;

const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard: Gas Usage', function(accounts) {
	it("transfer: transfer a card requires no more then 77866 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		const result = await card.transfer(accounts[1], 0x1);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed >= 77866 && gasUsed <= 114050, "transfer gas usage is too high: " + gasUsed);
	});

	it("card updates: set attributes requires no more then 34103 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		const result = await card.setAttributes(0x1, 7);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed >= 34103 && gasUsed <= 48778, "set attributes gas usage is too high: " + gasUsed);
	});
	it("card updates: add attributes requires no more then 34293 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 1);
		const result = await card.addAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed >= 34293 && gasUsed <= 48968, "add attributes gas usage is too high: " + gasUsed);
	});
	it("card updates: remove attributes requires no more then 34387 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 7);
		const result = await card.removeAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed >= 34387 && gasUsed <= 49062, "remove attributes gas usage is too high: " + gasUsed);
	});

	it("battle: playing a game requires no more then 84417 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		const result = await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed >= 84417 && gasUsed <= 142734, "playing a game gas usage is too high: " + gasUsed);
	});

});

