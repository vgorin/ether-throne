// role constants copied from CharacterCard.sol as is
const ROLE_CARD_CREATOR = 0x00000001;
const ROLE_COMBAT_PROVIDER = 0x00000002;
const ROLE_EXCHANGE = 0x00000004;
const ROLE_ROLE_MANAGER = 0x00000008;

const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard: Gas Usage', function(accounts) {
	it("transfer: transfer a card requires no more then 77886 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		const result = await card.transfer(accounts[1], 0x1);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed <= 77886, "transfer gas usage is to high: " + gasUsed);
	});

	it("card updates: set attributes requires no more then 34015 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		const result = await card.setAttributes(0x1, 7);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed <= 34015, "set attributes gas usage is to high: " + gasUsed);
	});
	it("card updates: add attributes requires no more then 34227 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.setAttributes(0x1, 1);
		const result = await card.addAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed <= 34227, "add attributes gas usage is to high: " + gasUsed);
	});
	it("card updates: remove attributes requires no more then 34299 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(0x1, accounts[0]);
		await card.setAttributes(0x1, 7);
		const result = await card.removeAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert(gasUsed <= 34299, "remove attributes gas usage is to high: " + gasUsed);
	});


});

