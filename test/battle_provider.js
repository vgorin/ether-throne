// role constants copied from AccessControl.sol as is
const ROLE_STATE_PROVIDER = 0x00200000;

// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_UNDEFINED = 0;
const GAME_OUTCOME_DEFEAT = 1;
const GAME_OUTCOME_DRAW = 2;
const GAME_OUTCOME_VICTORY = 3;

// character card structure defs
const GAMES_PLAYED_IDX = 1;
const WINS_COUNT_IDX = 2;
const LOSSES_COUNT_IDX = 3;
const LAST_GAME_OUTCOME_IDX = 4;


const CharacterCard = artifacts.require("./CharacterCard.sol");
const BattleProvider = artifacts.require("./BattleProvider.sol");

contract('BattleProvider', function(accounts) {
	it("battle: it is possible to play a game", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		assert.equal(1, (await battleProvider.battleStats(0x8001))[GAMES_PLAYED_IDX], "card 0x8001 games played counter is incorrect");
		assert.equal(1, (await battleProvider.battleStats(0x8002))[GAMES_PLAYED_IDX], "card 0x8002 games played counter is incorrect");
	});
	it("battle: game counters are stored correctly", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_VICTORY); // card1 won card2

		const stats1V = await battleProvider.battleStats(0x8001);
		const stats2V = await battleProvider.battleStats(0x8002);
		assert.equal(1, stats1V[GAMES_PLAYED_IDX], "card 0x8001 games played counter is incorrect");
		assert.equal(1, stats1V[WINS_COUNT_IDX], "card 0x8001 wins counter is incorrect");
		assert.equal(0, stats1V[LOSSES_COUNT_IDX], "card 0x8001 losses counter is incorrect");
		assert.equal(1, stats2V[GAMES_PLAYED_IDX], "card 0x8002 games played counter is incorrect");
		assert.equal(0, stats2V[WINS_COUNT_IDX], "card 0x8002 wins counter is incorrect");
		assert.equal(1, stats2V[LOSSES_COUNT_IDX], "card 0x8002 losses counter is incorrect");
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DEFEAT); // card1 lost card2

		const stats1D = await battleProvider.battleStats(0x8001);
		const stats2D = await battleProvider.battleStats(0x8002);
		assert.equal(2, stats1D[GAMES_PLAYED_IDX], "card 0x8001 games played counter is incorrect");
		assert.equal(1, stats1D[WINS_COUNT_IDX], "card 0x8001 wins counter is incorrect");
		assert.equal(1, stats1D[LOSSES_COUNT_IDX], "card 0x8001 losses counter is incorrect");
		assert.equal(2, stats2D[GAMES_PLAYED_IDX], "card 0x8002 games played counter is incorrect");
		assert.equal(1, stats2D[WINS_COUNT_IDX], "card 0x8002 wins counter is incorrect");
		assert.equal(1, stats2D[LOSSES_COUNT_IDX], "card 0x8002 losses counter is incorrect");
	});
	it("battle: last game outcome is GAME_OUTCOME_UNDEFINED initially", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		const outcome = (await battleProvider.battleStats(0x8001))[LAST_GAME_OUTCOME_IDX];
		assert.equal(GAME_OUTCOME_UNDEFINED, outcome, "initial game outcome for any card must be GAME_OUTCOME_UNDEFINED");
	});
	it("battle: last game outcome is stored correctly", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		let outcome1 = (await battleProvider.battleStats(0x8001))[LAST_GAME_OUTCOME_IDX];
		let outcome2 = (await battleProvider.battleStats(0x8002))[LAST_GAME_OUTCOME_IDX];
		assert.equal(GAME_OUTCOME_DRAW, outcome1, "card 0x8001 last game outcome is incorrect");
		assert.equal(GAME_OUTCOME_DRAW, outcome2, "card 0x8002 last game outcome is incorrect");
	});
	it("battle: last game outcome is updated correctly", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_VICTORY);
		let outcome1 = (await battleProvider.battleStats(0x8001))[LAST_GAME_OUTCOME_IDX];
		let outcome2 = (await battleProvider.battleStats(0x8002))[LAST_GAME_OUTCOME_IDX];
		assert.equal(GAME_OUTCOME_VICTORY, outcome1, "card 0x8001 last game outcome is incorrect (2nd game)");
		assert.equal(GAME_OUTCOME_DEFEAT, outcome2, "card 0x8002 last game outcome is incorrect (2nd game)");
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DEFEAT);
		outcome1 = (await battleProvider.battleStats(0x8001))[LAST_GAME_OUTCOME_IDX];
		outcome2 = (await battleProvider.battleStats(0x8002))[LAST_GAME_OUTCOME_IDX];
		assert.equal(GAME_OUTCOME_DEFEAT, outcome1, "card 0x8001 last game outcome is incorrect (3d game)");
		assert.equal(GAME_OUTCOME_VICTORY, outcome2, "card 0x8002 last game outcome is incorrect (3d game)");
	});
	it("battle: impossible to play a card game with oneself", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[0], 0x8002);
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: impossible to play a card game with one non-existent card", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		});
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8002, 0x8001, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: impossible to play a card game with both non-existent cards", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		});
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8002, 0x8001, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: impossible to update card battle without ROLE_STATE_PROVIDER permission", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await assertThrowsAsync(async function() {
			await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: ROLE_STATE_PROVIDER permission is enough to update card battle", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await battleProvider.battleComplete(0x8001, 0x8002, GAME_OUTCOME_DRAW);
		assert.equal(1, (await battleProvider.battleStats(0x8001))[GAMES_PLAYED_IDX], "card 0x8001 games played counter is incorrect");
		assert.equal(1, (await battleProvider.battleStats(0x8002))[GAMES_PLAYED_IDX], "card 0x8002 games played counter is incorrect");
	});

	it("battle: batch update", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);

		await battleProvider.battlesComplete(0x8001, 0x8002, 149999, 50001, 299999, GAME_OUTCOME_VICTORY);

		// check the results
		const stats1 = await battleProvider.battleStats(0x8001);
		const stats2 = await battleProvider.battleStats(0x8002);
		assert(299999, stats1[GAMES_PLAYED_IDX], "card 0x8001 has wrong total games played counter");
		assert(299999, stats2[GAMES_PLAYED_IDX], "card 0x8002 has wrong total games played counter");
		assert(149999, stats1[WINS_COUNT_IDX], "card 0x8001 has wrong wins counter");
		assert(50001, stats2[WINS_COUNT_IDX], "card 0x8002 has wrong wins counter");
		assert(50001, stats1[LOSSES_COUNT_IDX], "card 0x8001 has wrong losses counter");
		assert(149999, stats2[LOSSES_COUNT_IDX], "card 0x8002 has wrong losses counter");
	});
	it("battle: impossible to batch update if gamesPlayed is zero", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);

		// check it throws if gamesPlayed is zero
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 0, 0, 0, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: impossible to batch update if wins + loses is greater then gamesPlayed", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);

		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 1, 1, 1, GAME_OUTCOME_VICTORY);
		});
	});
	it("battle: impossible to batch update if lastGameOutcome is inconsistent with wins/losses", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);

		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 0, 1, 1, GAME_OUTCOME_VICTORY);
		});
		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 1, 0, 1, GAME_OUTCOME_DEFEAT);
		});
		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 1, 0, 1, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: arithmetic overflow check in input parameters", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);

		// check arithmetic overflow on wins
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 4294967295, 1, 1, GAME_OUTCOME_VICTORY);
		});
		// check arithmetic overflow on losses
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 1, 4294967295, 1, GAME_OUTCOME_VICTORY);
		});
	});
	it("battle: arithmetic overflow check on card state", async function() {
		const card = await CharacterCard.new();
		const battleProvider = await BattleProvider.new(card.address);
		await card.addOperator(battleProvider.address, ROLE_STATE_PROVIDER);
		await card.mint(accounts[0], 0x8001);
		await card.mint(accounts[1], 0x8002);
		await card.mint(accounts[2], 0x8003);

		await battleProvider.battlesComplete(0x8001, 0x8002, 1, 4294967294, 4294967295, GAME_OUTCOME_VICTORY);

		// check arithmetic overflow on gamesPlayed card1
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8001, 0x8002, 1, 0, 1, GAME_OUTCOME_VICTORY);
		});

		// check arithmetic overflow on gamesPlayed card2
		await assertThrowsAsync(async function() {
			await battleProvider.battlesComplete(0x8003, 0x8002, 1, 0, 1, GAME_OUTCOME_VICTORY);
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
