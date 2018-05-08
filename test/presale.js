// role constants copied from CharacterCard.sol as is
const ROLE_EXCHANGE = 0x00000001;
const ROLE_COMBAT_PROVIDER = 0x00000002;
const ROLE_CARD_CREATOR = 0x00000004;
const ROLE_ROLE_MANAGER = 0x00000008;

const INITIAL_CARD_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

const CharacterCard = artifacts.require("./CharacterCard.sol");
const DeprecatedCard = artifacts.require("./DeprecatedCard.sol");
const Presale = artifacts.require("./Presale.sol");

contract('Presale', function(accounts) {
	it("presale: it is impossible to create a presale with dummy values in the constructor", async function() {
		const card = await CharacterCard.new();
		const deprecatedCard = await DeprecatedCard.new();
		await assertThrowsAsync(async function() {await Presale.new();});
		await assertThrowsAsync(async function() {await Presale.new(accounts[0]);});
		await assertThrowsAsync(async function() {await Presale.new(0, accounts[0]);});
		await assertThrowsAsync(async function() {await Presale.new(card.address, 0);});
		await assertThrowsAsync(async function() {await Presale.new(card.address, card.address);});
		await assertThrowsAsync(async function() {await Presale.new(accounts[0], accounts[1]);});
		await assertThrowsAsync(async function() {await Presale.new(deprecatedCard.address, accounts[1]);});
	});
	it("presale: it is possible to buy a card", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_CARD_PRICE});

		assert.equal(1, await card.balanceOf(accounts[1]), "wrong card balance after buying a single card");
	});
	it("presale: it is possible to buy three cards", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_CARD_PRICE.times(2)});

		assert.equal(3, await card.balanceOf(accounts[1]), "wrong card balance after buying three cards");
	});
	it("presale: it is not possible to buy a card if sending too little ether", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);

		await assertThrowsAsync(async function () {
			await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_CARD_PRICE.minus(1)});
		});
	});
	it("presale: the funds are transferred to the beneficiary correctly", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);

		const beneficiary = await presale.beneficiary();
		const initialBeneficiaryBalance = await web3.eth.getBalance(beneficiary);
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_CARD_PRICE});
		const beneficiaryBalanceDelta = (await web3.eth.getBalance(beneficiary)).minus(initialBeneficiaryBalance);

		assert(INITIAL_CARD_PRICE.eq(beneficiaryBalanceDelta),
			"beneficiary balance is incorrect after selling one card");
	});
	it("presale: the change is transferred back to player correctly", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);

		const player = accounts[1];
		const initialPlayerBalance = await web3.eth.getBalance(player);
		const txHash = await presale.buyRandom.sendTransaction({
			from: player,
			value: INITIAL_CARD_PRICE.plus(1),
			gasPrice: 1
		});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const playerBalanceDelta = initialPlayerBalance.minus(await web3.eth.getBalance(player));
		const expectedDelta = INITIAL_CARD_PRICE.plus(txReceipt.gasUsed);

		assert(expectedDelta.eq(playerBalanceDelta), "player balance is incorrect after buying one card");
	});
	it("presale: the funds and change are transferred correctly", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);

		const player = accounts[1];

		// send some random amount of money to the presale 10 times in a raw and check the results
		let expectedCardsNumber = 0;
		for(let i = 0; i < 10; i++) {
			const valueToSend = INITIAL_CARD_PRICE.times(random(0, 3, 2));
			if(valueToSend.lt(INITIAL_CARD_PRICE)) {
				await assertThrowsAsync(async function() {
					await presale.buyRandom.sendTransaction({from: player, value: valueToSend});
				});
			}
			else {
				const initialPlayerBalance = await web3.eth.getBalance(player);
				const txHash = await presale.buyRandom.sendTransaction({
					from: player,
					value: valueToSend,
					gasPrice: 1
				});
				const txReceipt = await web3.eth.getTransactionReceipt(txHash);
				const playerBalanceDelta = initialPlayerBalance.minus(await web3.eth.getBalance(player));
				let expectedDelta;
				if(valueToSend.gte(INITIAL_CARD_PRICE.times(2))) {
					expectedDelta = INITIAL_CARD_PRICE.times(2).plus(txReceipt.gasUsed);
					expectedCardsNumber += 3;
				}
				else {
					expectedDelta = INITIAL_CARD_PRICE.plus(txReceipt.gasUsed);
					expectedCardsNumber++;
				}
				assert(expectedDelta.eq(playerBalanceDelta),
					"player balance is incorrect after sending " + web3.toWei(valueToSend, 'finney'));
			}
		}
		assert.equal(expectedCardsNumber, await card.balanceOf(player), "wrong number of cards owned by player");
	});
	it("presale: its possible to buy a card for someone else", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_CARD_CREATOR);

		await presale.buyRandomFor.sendTransaction(accounts[1], {value: INITIAL_CARD_PRICE});
		assert.equal(1, await card.balanceOf(accounts[1]), "wrong balance after buying a card for " + accounts[1])
	});
	it("presale: its impossible to buy a card for a zero address", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);

		await assertThrowsAsync(async function() {
			await presale.buyRandomFor.sendTransaction(0, {value: INITIAL_CARD_PRICE})
		});
	});
	it("presale: its impossible to buy a card for a presale smart contract itself", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[2]);

		await assertThrowsAsync(async function() {
			await presale.buyRandomFor.sendTransaction(presale.address, {value: INITIAL_CARD_PRICE})
		});
	});
});

// ensures that the function passed throws an exception
// usage example: await assertThrowsAsync(async function(){// do some sync stuff});
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

// generates a random number with `decimal` decimal places,
// the number is in range min - max, all numbers are not a BigNumber kind!
function random(min, max, decimals) {
	const k = Math.pow(10, decimals);
	return min + Math.floor(k * (max - min) * Math.random()) / k;
}
