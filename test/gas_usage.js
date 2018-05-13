// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_DRAW = 2;

// role constants copied from AccessControl.sol as is
const ROLE_STATE_PROVIDER = 0x00200000;

// role constants copied from CharacterCard.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

const INITIAL_CARD_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

const CharacterCard = artifacts.require("./CharacterCard.sol");
const BattleProvider = artifacts.require("./BattleProvider.sol");
const Presale = artifacts.require("./Presale.sol");

contract('Gas Usage', function(accounts) {
	it("deployment: deploying a character cards requires 4319119 gas", async function() {
		const card = await CharacterCard.new();
		const txHash = card.transactionHash;
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(4319119, gasUsed, "character card deployment gas usage doesn't match: " + gasUsed);
	});
	it("deployment: deploying a presale requires 4186439 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		const txHash = presale.transactionHash;
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(4186439, gasUsed, "presale deployment gas usage doesn't match: " + gasUsed);
	});

	it("ERC20 transfer: transfer 192 cards requires 6298643 gas", async function() {
		const card = await CharacterCard.new();
		for(let i = 1; i <= 192; i++) {
			await card.mint(accounts[0], 0x400 + i);
		}
		const result = await card.transfer(accounts[1], 192);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(6298643, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});
	it("ERC20 transfer: transfer 128 cards requires 4212087 gas", async function() {
		const card = await CharacterCard.new();
		for(let i = 1; i <= 128; i++) {
			await card.mint(accounts[0], 0x400 + i);
		}
		const result = await card.transfer(accounts[1], 128);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(4212087, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});
	it("ERC20 transfer: transfer 64 cards requires 2125531 gas", async function() {
		const card = await CharacterCard.new();
		for(let i = 1; i <= 64; i++) {
			await card.mint(accounts[0], 0x400 + i);
		}
		const result = await card.transfer(accounts[1], 64);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(2125531, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("transferCard: transfer a card requires 80213 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		const result = await card.transferToken(accounts[1], 0x401);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(80213, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("card updates: set attributes requires 34450 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		const result = await card.setAttributes(0x401, 7);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(34450, gasUsed, "set attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: add attributes requires 34596 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.setAttributes(0x401, 1);
		const result = await card.addAttributes(0x401, 2);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(34596, gasUsed, "add attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: remove attributes requires 34668 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.setAttributes(0x401, 7);
		const result = await card.removeAttributes(0x401, 2);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(34668, gasUsed, "remove attributes gas usage doesn't match: " + gasUsed);
	});

	it("presale: buying a single card requires 198329 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);
		const txHash = await presale.buyRandom.sendTransaction({value: INITIAL_CARD_PRICE});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(198329, gasUsed, "buying a card gas usage doesn't match: " + gasUsed);
	});
	it("presale: buying three cards requires 444577 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);
		const txHash = await presale.buyRandom.sendTransaction({value: INITIAL_CARD_PRICE.times(2)});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(444577, gasUsed, "buying three cards gas usage doesn't match: " + gasUsed);
	});

	it("battle: playing a game requires 140006 gas", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[1], 0x402);
		const result = await battleProvider.battleComplete(0x401, 0x402, GAME_OUTCOME_DRAW);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(140006, gasUsed, "playing a game gas usage doesn't match: " + gasUsed);
	});
});

function assertEqual(expected, actual, msg) {
	assertEqualWith(expected, 0.05, actual, msg);
}

function assertEqualWith(expected, leeway, actual, msg) {
	assert(expected * (1 - leeway) < actual && expected * (1 + leeway) > actual, msg);
}
