// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_DRAW = 2;

// role constants copied from AccessControl.sol as is
const ROLE_STATE_PROVIDER = 0x00200000;

// role constants copied from CharacterCard.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

// feature constants copied from CharacterCard.sol as is
const FEATURE_TRANSFERS = 0x00000001;
const ERC20_TRANSFERS = 0x00000004;

const INITIAL_CARD_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

const CharacterCard = artifacts.require("./CharacterCard.sol");
const BattleProvider = artifacts.require("./BattleProvider.sol");
const Presale = artifacts.require("./Presale.sol");

contract('Gas Usage', function(accounts) {
	it("deployment: deploying a character cards requires 6612272 gas", async function() {
		const card = await CharacterCard.new();
		const txHash = card.transactionHash;
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(6612272, gasUsed, "character card deployment gas usage doesn't match: " + gasUsed);
	});
	it("deployment: deploying a presale requires 3401390 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		const txHash = presale.transactionHash;
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assertEqual(3401390, gasUsed, "presale deployment gas usage doesn't match: " + gasUsed);
	});

	it("ERC20 transfer: transfer 192 cards requires 6298643 gas", async function() {
		const card = await CharacterCard.new();
		await card.updateFeatures(ERC20_TRANSFERS);
		for(let i = 1; i <= 192; i++) {
			await card.mint(accounts[0], 0x8000 + i);
		}
		const result = await card.transfer(accounts[1], 192);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(6298643, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});
	it("ERC20 transfer: transfer 128 cards requires 4212087 gas", async function() {
		const card = await CharacterCard.new();
		await card.updateFeatures(ERC20_TRANSFERS);
		for(let i = 1; i <= 128; i++) {
			await card.mint(accounts[0], 0x8000 + i);
		}
		const result = await card.transfer(accounts[1], 128);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(4212087, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});
	it("ERC20 transfer: transfer 64 cards requires 2125531 gas", async function() {
		const card = await CharacterCard.new();
		await card.updateFeatures(ERC20_TRANSFERS);
		for(let i = 1; i <= 64; i++) {
			await card.mint(accounts[0], 0x8000 + i);
		}
		const result = await card.transfer(accounts[1], 64);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(2125531, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("transferCard: transfer a card requires 80213 gas", async function() {
		const card = await CharacterCard.new();
		await card.updateFeatures(FEATURE_TRANSFERS);
		await card.mint(accounts[0], 0x8001);
		const result = await card.transferToken(accounts[1], 0x8001);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(80213, gasUsed, "transfer gas usage doesn't match: " + gasUsed);
	});

	it("card updates: set attributes requires 37648 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x8001);
		const result = await card.setAttributes(0x8001, 7);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(37648, gasUsed, "set attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: add attributes requires 37860 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x8001);
		await card.setAttributes(0x8001, 1);
		const result = await card.addAttributes(0x8001, 2);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(37860, gasUsed, "add attributes gas usage doesn't match: " + gasUsed);
	});
	it("card updates: remove attributes requires 38284 gas", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x8001);
		await card.setAttributes(0x8001, 7);
		const result = await card.removeAttributes(0x8001, 2);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(38284, gasUsed, "remove attributes gas usage doesn't match: " + gasUsed);
	});

	it("presale: buying single card requires 273094 gas, three cards - 444577 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);

		const txHash1 = await presale.buyOneRandom.sendTransaction({value: INITIAL_CARD_PRICE});
		const txReceipt1 = await web3.eth.getTransactionReceipt(txHash1);
		const gasUsed1 = txReceipt1.gasUsed;
		assertEqual(273094, gasUsed1, "buying a card gas usage doesn't match: " + gasUsed1);

		const txHash3 = await presale.buyThreeRandom.sendTransaction({value: INITIAL_CARD_PRICE.times(2)});
		const txReceipt3 = await web3.eth.getTransactionReceipt(txHash3);
		const gasUsed3 = txReceipt3.gasUsed;
		assertEqual(498066, gasUsed3, "buying three cards gas usage doesn't match: " + gasUsed3);
	});

	it("battle: playing a game requires 165518 gas", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		const result = await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		const gasUsed = result.receipt.gasUsed;
		assertEqual(165518, gasUsed, "playing a game gas usage doesn't match: " + gasUsed);
	});
});

function assertEqual(expected, actual, msg) {
	assertEqualWith(expected, 0.1, actual, msg);
}

function assertEqualWith(expected, leeway, actual, msg) {
	assert(expected * (1 - leeway) < actual && expected * (1 + leeway) > actual, msg);
}

// creates and initializes the presale, consumes 50kk gas
async function createPresale(cardInstanceAddress, beneficiaryAddress) {
	const presale = await Presale.new(cardInstanceAddress, beneficiaryAddress);
	let cumulativeGasUsed = 0;
	for(let i = 0; i < 8; i++) {
		assert(!await presale.initialized(), "presale is already initialized");
		const result = await presale.init(512);
		const gasUsed = result.receipt.gasUsed;
		cumulativeGasUsed += gasUsed;
		assert(gasUsed < 7000000, "gas usage in presale init exceeds 7 000 000: " + gasUsed);
	}
	console.log("\tpresale init gas used: " + cumulativeGasUsed);
	assert(await presale.initialized(), "presale is not initialized after 8 rounds");
	return presale;
}
