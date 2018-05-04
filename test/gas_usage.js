// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_UNDEFINED = 0;
const GAME_OUTCOME_DEFEAT = 1;
const GAME_OUTCOME_DRAW = 2;
const GAME_OUTCOME_VICTORY = 3;

const ROLE_CARD_CREATOR = 0x00000004;
const INITIAL_CARD_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

const CharacterCard = artifacts.require("./CharacterCard.sol");
const Presale = artifacts.require("./Presale.sol");

contract('CharacterCard: Gas Usage', function(accounts) {
	it("deployment: deploying a character cards smart contract requires 5554571 gas", async function() {
		const result = await CharacterCard.new();
		const txHash = result.transactionHash;
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assert.equal(5554571, gasUsed, "character card smart contract deployment gas usage doesn't match: " + gasUsed);
	});

	it("ERC20 transfer: transfer 128 cards requires 4132401 gas", async function() {
		const card = await CharacterCard.new();
		for(let i = 1; i <= 128; i++) {
			await card.mint(accounts[0], i);
		}
		const result = await card.transfer(accounts[1], 128);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(4132401, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("transferCard: transfer a card requires 79671 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		const result = await card.transferCard(accounts[1], 0x1);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(79671, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("card updates: set attributes requires 34191 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		const result = await card.setAttributes(0x1, 7);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(34191, gasUsed, "set attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: add attributes requires 34381 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 1);
		const result = await card.addAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(34381, gasUsed, "add attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: remove attributes requires 34475 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 7);
		const result = await card.removeAttributes(0x1, 2);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(34475, gasUsed, "remove attributes gas usage doesn't match: " + gasUsed);
	});

	it("battle: playing a game requires 87047 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		const result = await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);
		const gasUsed = result.receipt.gasUsed;
		assert.equal(87047, gasUsed, "playing a game gas usage doesn't match: " + gasUsed);
	});

	it("presale: buying a single card requires 193599 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		const txHash = await presale.buy.sendTransaction({value: INITIAL_CARD_PRICE});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assert.equal(193599, gasUsed, "buying a card gas usage doesn't match: " + gasUsed);
	});
	it("presale: buying three cards requires 449895 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		const txHash = await presale.buy.sendTransaction({value: INITIAL_CARD_PRICE.times(2)});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assert.equal(449895, gasUsed, "buying three cards gas usage doesn't match: " + gasUsed);
	});
});

