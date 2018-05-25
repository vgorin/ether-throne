// role constants copied from AccessControl.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

const CharacterCard = artifacts.require("./CharacterCard.sol");
const Presale = artifacts.require("./Presale.sol");

String.prototype.pad = function(size) {
	let s = this;
	while(s.length < (size || 2)) {
		s = "0" + s;
	}
	return s;
};

contract('Presale 4000', function(accounts) {
	it("presale: buy 4000 cards randomly", async() => {
		const card = await CharacterCard.new();
		const presale = await createPresale(card.address, accounts[16]);
		await card.addOperator(presale.address, ROLE_TOKEN_CREATOR);
		console.log("\tpresale initialized: 4000 cards created, initial price: "
			+ web3.fromWei(await presale.currentPrice(), "ether") + " ETH");

		const value = web3.toWei(1, "ether");

		// buy 4000 cards by 3 in single transaction
		// 1333 transactions will have 3 cards and the last one - 1 card
		const length = 1334;
		for(let i = 0; i < length; i++) {
			const fn = i < length - 1 ? presale.buyThreeRandom : presale.buyOneRandom;
			await fn.sendTransaction({value: value, from: accounts[(i) % 10]});

			const cardsSold = Math.min((i + 1) * 3, 4000);

			if(
				cardsSold < 403 && (
					Math.floor(cardsSold / 20) < Math.floor((cardsSold + 3) / 20)
					|| Math.floor(cardsSold / 20) > Math.floor((cardsSold - 3) / 20)
				)
				|| cardsSold > 998 && cardsSold < 1003
				|| cardsSold > 1997 && cardsSold < 2002
				|| cardsSold > 2996 && cardsSold < 3001
				|| cardsSold > 3497 && cardsSold < 3502
				|| cardsSold > 3999
			) {
				const currentPrice = web3.fromWei(await presale.currentPrice(), "ether");
				console.log("\t" + cardsSold + " cards sold (transaction "
					+ i + " of " + length + "), current price: " + currentPrice + " ETH");
			}
		}

		// it should not be possible to buy more then 4000 cards
		await assertThrowsAsync(async() => {
			await presale.buyRandom.sendTransaction({value: value});
		});

		assert.equal(4000, await presale.sold(), "incorrect value of cards sold");
		assert.equal(0, await presale.left(), "incorrect value of cards left");

		const bitmap = await presale.getBitmap();
		let msg = "\tavailable cards bitmap after buying all the cards: ";
		for(let i = 0; i < bitmap.length; i++) {
			msg += bitmap[i].toString(2).pad(256).split("").reverse().join("");
		}
		console.log(msg);

		for(let i = 0; i < 10; i++) {
			console.log("\tcards[" + i + "]: " + await card.getCollection(accounts[i]));
		}
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
