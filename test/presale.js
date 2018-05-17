// role constants copied from AccessControl.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

const INITIAL_TOKEN_PRICE = web3.toBigNumber(web3.toWei(50, 'finney'));

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
		const presale = await Presale.new(card.address, accounts[0]);
		assert(!await presale.initialized(), "presale is initialized but it should not");
	});
	it("presale: create presale and check it", async function() {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[0]);
		const availableCards = await presale.getAvailableCardsBitmap();
		assert.equal(16, availableCards.length, "available card bitmap is corrupted");
		for(let i = 0; i < availableCards.length; i++) {
			assert(availableCards[i].eq("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), "incorrect bitmap " + i);
		}
	});
	it("presale: buying some card(s)", async function() {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);

		// buying usual card,
		// sending not enough ether
		await assertThrowsAsync(async function () {
			await presale.buySpecific.sendTransaction(0x440, {from: accounts[1], value: INITIAL_TOKEN_PRICE.times(10).minus(1)});
		});
		// sending enough ether
		await presale.buySpecific.sendTransaction(0x440, {from: accounts[1], value: INITIAL_TOKEN_PRICE.times(10)});
		assert.equal(1, await card.balanceOf(accounts[1]), "wrong card balance after buying usual card");

		// buying usual card for
		await presale.buySpecificFor.sendTransaction(accounts[1], 0x441, {value: INITIAL_TOKEN_PRICE.times(10)});
		assert.equal(2, await card.balanceOf(accounts[1]), "wrong card balance after buying usual card for");

		// buying one random card,
		// sending not enough ether
		await assertThrowsAsync(async function () {
			await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_TOKEN_PRICE.minus(1)});
		});
		// sending enough ether
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_TOKEN_PRICE});
		assert.equal(3, await card.balanceOf(accounts[1]), "wrong card balance after buying a single card");

		// buying 3 random cards at once
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_TOKEN_PRICE.times(2)});
		assert.equal(6, await card.balanceOf(accounts[1]), "wrong card balance after buying three cards");

		// buying random card for
		await presale.buyRandomFor.sendTransaction(accounts[1], {value: INITIAL_TOKEN_PRICE});
		assert.equal(7, await card.balanceOf(accounts[1]), "wrong balance after buying a card for " + accounts[1]);

		// buying 3 random cards for at once
		await presale.buyRandomFor.sendTransaction(accounts[1], {value: INITIAL_TOKEN_PRICE.times(2)});
		assert.equal(10, await card.balanceOf(accounts[1]), "wrong balance after buying a card for " + accounts[1]);
	});
	it("presale: funds and change are transferred correctly", async function() {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);

		const beneficiary = await presale.beneficiary();
		const initialBeneficiaryBalance = await web3.eth.getBalance(beneficiary);
		await presale.buyRandom.sendTransaction({from: accounts[1], value: INITIAL_TOKEN_PRICE});
		const beneficiaryBalanceDelta = (await web3.eth.getBalance(beneficiary)).minus(initialBeneficiaryBalance);

		assert(INITIAL_TOKEN_PRICE.eq(beneficiaryBalanceDelta),
			"beneficiary balance is incorrect after selling one card");

		const player = accounts[1];
		const initialPlayerBalance = await web3.eth.getBalance(player);
		const txHash = await presale.buyRandom.sendTransaction({
			from: player,
			value: INITIAL_TOKEN_PRICE.plus(1),
			gasPrice: 1
		});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const playerBalanceDelta = initialPlayerBalance.minus(await web3.eth.getBalance(player));
		const expectedDelta = INITIAL_TOKEN_PRICE.plus(txReceipt.gasUsed);

		assert(expectedDelta.eq(playerBalanceDelta), "player balance is incorrect after buying one card");

		// send some random amount of money to the presale 10 times in a raw and check the results
		let expectedCardsNumber = await card.balanceOf(player);
		for(let i = 0; i < 10; i++) {
			const currentPrice = await presale.currentPrice();
			const valueToSend = currentPrice.times(random(0, 3, 2));
			if(valueToSend.lt(currentPrice)) {
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
				if(valueToSend.gte(currentPrice.times(2))) {
					expectedDelta = currentPrice.times(2).plus(txReceipt.gasUsed);
					expectedCardsNumber = expectedCardsNumber.plus(3);
				}
				else {
					expectedDelta = currentPrice.plus(txReceipt.gasUsed);
					expectedCardsNumber = expectedCardsNumber.plus(1);
				}
				assert(expectedDelta.eq(playerBalanceDelta),
					"player balance is incorrect after sending " + web3.toWei(valueToSend, 'finney'));
			}
		}
		const playerBalance = await card.balanceOf(player);
		assert(expectedCardsNumber.eq(playerBalance),
			"wrong number of cards owned by player, expected " + expectedCardsNumber + ", got " + playerBalance);
	});
	it("presale: impossible to buy a card for a zero address, smart contract(s) itself", async function() {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[2]);

		await assertThrowsAsync(async function() {
			await presale.buyRandomFor.sendTransaction(0, {value: INITIAL_TOKEN_PRICE})
		});

		await assertThrowsAsync(async function() {
			await presale.buyRandomFor.sendTransaction(presale.address, {value: INITIAL_TOKEN_PRICE})
		});

		await assertThrowsAsync(async function() {
			await presale.buyRandomFor.sendTransaction(card.address, {value: INITIAL_TOKEN_PRICE})
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

// creates and initializes the presale, consumes 50kk gas
async function createPresale(cardInstanceAddress, beneficiaryAddress) {
	const presale = await Presale.new(cardInstanceAddress, beneficiaryAddress);
	for(let i = 0; i < 8; i++) {
		assert(!await presale.initialized(), "presale is already initialized");
		await presale.init(512);
	}
	assert(await presale.initialized(), "presale is not initialized after 8 rounds");
	return presale;
}
