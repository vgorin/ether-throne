// role constants copied from AccessControl.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

const CharacterCard = artifacts.require("./CharacterCard.sol");
const DeprecatedCard = artifacts.require("./DeprecatedCard.sol");
const Presale = artifacts.require("./Presale.sol");

String.prototype.pad = function(size) {
	let s = this;
	while (this.length < (size || 2)) {
		s = "0" + s;
	}
	return s;
};
contract('Presale', function(accounts) {
	it("presale: it is impossible to create a presale with dummy values in the constructor", async() => {
		const card = await CharacterCard.new();
		const deprecatedCard = await DeprecatedCard.new();
		await assertThrowsAsync(async() => {await Presale.new();});
		await assertThrowsAsync(async() => {await Presale.new(accounts[0]);});
		await assertThrowsAsync(async() => {await Presale.new(0, accounts[0]);});
		await assertThrowsAsync(async() => {await Presale.new(card.address, 0);});
		await assertThrowsAsync(async() => {await Presale.new(card.address, card.address);});
		await assertThrowsAsync(async() => {await Presale.new(accounts[0], accounts[1]);});
		await assertThrowsAsync(async() => {await Presale.new(deprecatedCard.address, accounts[1]);});
		const presale = await Presale.new(card.address, accounts[0]);
		assert(!await presale.initialized(), "diskpresale is initialized but it should not");
	});
	it("presale: create presale and check it", async() => {
		const card = await CharacterCard.new();
		const presale = await Presale.new(card.address, accounts[0]);
		const currentPrice = await presale.currentPrice();
		const nextPrice = await presale.nextPrice();
		assert(currentPrice.eq(nextPrice), "current / next price initial mismatch");
		const bitmap = await presale.getBitmap();
		assert.equal(16, bitmap.length, "available card bitmap is corrupted");
		for(let i = 0; i < bitmap.length - 1; i++) {
			assert(bitmap[i].eq("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
				"incorrect bitmap " + i);
		}
		assert(bitmap[bitmap.length - 1].eq("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
			"incorrect bitmap " + (bitmap.length - 1));
	});
	it("presale: buying some card(s), check funds and change transfer(s)", async() => {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[2]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);

		const player = accounts[1];

		// get the initial card price from the presale contract
		const INITIAL_PRICE = await presale.INITIAL_PRICE();

		// buying usual card,
		// sending not enough ether
		await assertThrowsAsync(async() => {
			await presale.buySpecific.sendTransaction(0x440, {from: player, value: INITIAL_PRICE.times(10).minus(1)});
		});
		// sending enough ether
		await presale.buySpecific.sendTransaction(0x440, {from: player, value: INITIAL_PRICE.times(10)});
		assert.equal(1, await card.balanceOf(player), "wrong card balance after buying usual card");

		// buying usual card for
		await presale.buySpecificFor.sendTransaction(player, 0x441, {value: INITIAL_PRICE.times(10)});
		assert.equal(2, await card.balanceOf(player), "wrong card balance after buying usual card for");

		// check Presale.bitmap vs CharacterCard.exists consistency
		// card ID 0x1130 bitmap pos 0x1130 - 0x401 = 0xD2F, bucket 0xD (13), pos 0x2F or 0xD0 from the left
		await presale.buySpecific.sendTransaction(0x1130, {from: player, value: INITIAL_PRICE.times(10)});
		assert(await card.exists(0x1130), "card 0x1130 doesn't exist after it was bought");
		const bitmap0xD = (await presale.getBitmap())[0xD].toString(2);
		assert.equal("0", bitmap0xD.charAt(0xD0), "cards 0x1130 is not absent in presale bitmap after it was bought");

		// buying one random card,
		// sending not enough ether
		await assertThrowsAsync(async() => {
			await presale.buyOneRandom.sendTransaction({from: player, value: INITIAL_PRICE.minus(1)});
		});
		// sending not enough ether
		await assertThrowsAsync(async() => {
			await presale.buyThreeRandom.sendTransaction({from: player, value: INITIAL_PRICE.times(2).minus(1)});
		});
		// sending enough ether
		await presale.buyOneRandom.sendTransaction({from: player, value: INITIAL_PRICE});
		assert.equal(4, await card.balanceOf(player), "wrong card balance after buying a single card");

		// buying 3 random cards at once
		await presale.buyThreeRandom.sendTransaction({from: player, value: INITIAL_PRICE.times(2)});
		assert.equal(7, await card.balanceOf(player), "wrong card balance after buying three cards");

		// buying random card for
		await presale.buyOneRandomFor.sendTransaction(player, {value: INITIAL_PRICE});
		assert.equal(8, await card.balanceOf(player), "wrong balance after buying a card for " + player);

		// buying 3 random cards for at once
		await presale.buyThreeRandomFor.sendTransaction(player, {value: INITIAL_PRICE.times(2)});
		assert.equal(11, await card.balanceOf(player), "wrong balance after buying three cards for " + player);

		// check it throws when buying to invalid address
		await assertThrowsAsync(async() => {
			await presale.buyOneRandomFor.sendTransaction(0, {value: INITIAL_PRICE})
		});
		await assertThrowsAsync(async() => {
			await presale.buyOneRandomFor.sendTransaction(presale.address, {value: INITIAL_PRICE})
		});
		await assertThrowsAsync(async() => {
			await presale.buyOneRandomFor.sendTransaction(card.address, {value: INITIAL_PRICE})
		});

		// main test cycle
		const beneficiary = await presale.beneficiary();
		assert.equal(accounts[2], beneficiary, "wrong beneficiary");
		const initialBeneficiaryBalance = await web3.eth.getBalance(beneficiary);
		await presale.buyOneRandom.sendTransaction({from: accounts[1], value: INITIAL_PRICE});
		const beneficiaryBalanceDelta = (await web3.eth.getBalance(beneficiary)).minus(initialBeneficiaryBalance);

		assert(INITIAL_PRICE.eq(beneficiaryBalanceDelta),
			"beneficiary balance is incorrect after selling one card");

		const initialPlayerBalance = await web3.eth.getBalance(player);
		const txHash = await presale.buyOneRandom.sendTransaction({
			from: player,
			value: INITIAL_PRICE.plus(1),
			gasPrice: 1
		});
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		const playerBalanceDelta = initialPlayerBalance.minus(await web3.eth.getBalance(player));
		const expectedDelta = INITIAL_PRICE.plus(txReceipt.gasUsed);

		assert(expectedDelta.eq(playerBalanceDelta), "player balance is incorrect after buying one card");

		// send some random amount of money to the presale 10 times in a raw and check the results
		let expectedCardsNumber = await card.balanceOf(player);
		for(let i = 0; i < 10; i++) {
			const currentPrice = await presale.currentPrice();
			const valueToSend = currentPrice.times(random(0, 3, 2));
			if(valueToSend.lt(currentPrice)) {
				await assertThrowsAsync(async() => {
					await presale.buyOneRandom.sendTransaction({from: player, value: valueToSend});
				});
			}
			else {
				const initialPlayerBalance = await web3.eth.getBalance(player);
				const fn = valueToSend.lt(currentPrice.times(2)) ? presale.buyOneRandom : presale.buyThreeRandom;
				const txHash = await fn.sendTransaction({
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

/*
		const bitmap = await presale.getBitmap();
		let msg = "\tavailable cards bitmap after buying " + expectedCardsNumber + " cards: ";
		for(let i = 0; i < bitmap.length; i++) {
			msg += bitmap[i].toString(2).pad(256).split("").reverse().join("");
		}
		console.log(msg);
*/

		console.log("\towned cards: " + await card.getCollection(player));
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
