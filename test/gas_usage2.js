const ROLE_CARD_CREATOR = 0x00000001;
const INITIAL_CARD_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

const CharacterCard = artifacts.require("./CharacterCard.sol");
const Presale = artifacts.require("./Presale.sol");

contract('Presale: Gas Usage', function(accounts) {
	it("presale: buying a single card requires no more then 193863 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		const txHash = await presale.buy.sendTransaction({value: INITIAL_CARD_PRICE});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assert(gasUsed <= 193863, "buying a card gas usage is too high: " + gasUsed);
	});
	it("presale: buying three cards requires no more then 449961 gas", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		const txHash = await presale.buy.sendTransaction({value: INITIAL_CARD_PRICE.times(2)});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const gasUsed = txReceipt.gasUsed;
		assert(gasUsed <= 449961, "buying three cards gas usage is too high: " + gasUsed);
	});
});
