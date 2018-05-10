// role constants copied from CharacterCard.sol as is
const ROLE_COMBAT_PROVIDER = 0x00020000;
const ROLE_CARD_CREATOR = 0x00040000;
const ROLE_ROLE_MANAGER = 0x00100000;

// game outcome constants copied from CharacterCard.sol as is
const GAME_OUTCOME_UNDEFINED = 0;
const GAME_OUTCOME_DEFEAT = 1;
const GAME_OUTCOME_DRAW = 2;
const GAME_OUTCOME_VICTORY = 3;
const LAST_GAME_OUTCOME_BITS = 0x3;

// character card structure defs
const RARITY_IDX = 1;
const ATTRIBUTES_IDX = 3;
const GAMES_PLAYED_IDX = 5;
const WINS_COUNT_IDX = 6;
const LOSSES_COUNT_IDX = 7;
const CARD_ID_IDX = 8;
const CARD_IDX_IDX = 9;
const CARD_OWN_MOD_IDX = 11;
const CARD_OWNER_IDX = 12;

const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard', function(accounts) {
	it("initial state", async function() {
		const card = await CharacterCard.new();
		assert.equal(0, await card.totalSupply(), "initial totalSupply must be zero");
		assert.equal(0, await card.balanceOf(accounts[0]), "initial card balance must be zero");
		assert(!await card.exists(0x1), "card 0x1 should not exist initially");
		await assertThrowsAsync(async function() {await card.ownerOf(0x1);});
		await assertThrowsAsync(async function() {await card.getCard(0x1);});
		await assertThrowsAsync(async function() {await card.getState(0x1);});
		await assertThrowsAsync(async function() {await card.getAttributes(0x1);});
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 0);});
	});

	it("roles: add an operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		assert(await card.userRoles(accounts[1]) > 0, accounts[1] + " must be an operator but its not");
	});
	it("roles: operator adds another operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER | 0x1);
		await card.addOperator.sendTransaction(accounts[2], 0x1, {from: accounts[1]});
		assert(await card.userRoles(accounts[2]) > 0, accounts[2] + " must be an operator but its not");
	});
	it("roles: remove operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		assert(await card.userRoles(accounts[1]) > 0, accounts[1] + " must be an operator but its not");
		await card.removeOperator(accounts[1]);
		assert(await card.userRoles(accounts[1]) == 0, accounts[1] + " must not be an operator but it is");
	});
	it("roles: operator removes another operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], 0x1);
		assert(await card.userRoles(accounts[2]) > 0, accounts[2] + " must be an operator but its not");
		await card.removeOperator.sendTransaction(accounts[2], {from: accounts[1]});
		assert(await card.userRoles(accounts[2]) == 0, accounts[2] + " must not be an operator but it is");
	});
	it("roles: impossible to add more powerful operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: account[1]});
		});
	});
	it("roles: impossible to add an operator without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		});
	});
	it("roles: impossible to remove an operator without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.removeOperator.sendTransaction(accounts[2], {from: accounts[1]});
		});
	});
	it("roles: impossible to add an operator without permissions", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addOperator(accounts[1], 0);});
	});
	it("roles: impossible to remove non-existing operator", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.removeOperator(accounts[1]);});
	});
	it("roles: impossible to add operator which already exists", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addOperator(accounts[0], 0x1);});
	});
	it("roles: ROLE_CARD_SELLER role is enough to mint a card", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.mint.sendTransaction(accounts[1], 0x1, {from: accounts[1]});
		assert.equal(1, await card.totalSupply(), "card was not minted, totalSupply is not 1");
		assert.equal(1, await card.balanceOf(accounts[1]), "card was not minted, balanceOf " + accounts[1] + " is not 1");
		assert(await card.exists(0x1), "card was not minted, card 0x1 doesn't exist");
	});
	it("roles: operator cannot remove himself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.removeOperator(accounts[0]);});
	});

	it("permissions: add role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addRole(accounts[1], ROLE_COMBAT_PROVIDER);
		assert(hasRole(await card.userRoles(accounts[1]), ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER was not added");
	});
	it("permissions: remove role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_COMBAT_PROVIDER);
		assert(hasRole(await card.userRoles(accounts[1]), ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER must be enabled initially");
		await card.removeRole(accounts[1], ROLE_COMBAT_PROVIDER);
		assert(!hasRole(await card.userRoles(accounts[1]), ROLE_COMBAT_PROVIDER), "role ROLE_COMBAT_PROVIDER was not removed");
	});
	it("permissions: impossible to add role without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.addOperator(accounts[2], ROLE_COMBAT_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		});
	});
	it("permissions: impossible to remove role without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_COMBAT_PROVIDER);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR | ROLE_COMBAT_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.removeRole.sendTransaction(accounts[2], ROLE_COMBAT_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: impossible to remove role which caller doesn't have", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR | ROLE_COMBAT_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.removeRole.sendTransaction(accounts[2], ROLE_COMBAT_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: add role using ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_COMBAT_PROVIDER);
		await card.addRole.sendTransaction(accounts[2], ROLE_CARD_CREATOR, {from: accounts[1]});
		assert(hasRole(await card.userRoles(accounts[2]), ROLE_CARD_CREATOR), "role ROLE_CARD_CREATOR was not added");
	});
	it("permissions: impossible to add role using user without same role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_CARD_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_COMBAT_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: impossible to add role to non-existing operator", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.addRole(accounts[1], 0x1);});
	});
	it("permissions: impossible to remove last role leaving operator without any permissions", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.removeRole(accounts[1], 0x1);});
	});

	it("mint: mint a card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		assert.equal(1, await card.totalSupply(), "totalSupply after minting a card must be 1");
		assert.equal(1, await card.balanceOf(accounts[0]), "card balance after minting a card must be 1");
		assert(await card.exists(0x1), "card 0x1 doesn't exist after minting");
		assert.equal(accounts[0], await card.ownerOf(0x1), "card 0x1 has wrong owner after minting it to " + accounts[0]);
	});
	it("mint: mint a card and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		assert.equal(0x1, await card.collections(accounts[0], 0), accounts[0] + " card collection doesn't contain minted card");
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 1);});

		const card0x1 = await card.cards(0x1);

		assert.equal(0x1, card0x1[CARD_ID_IDX], "newly minted card has wrong id");
		assert.equal(0, card0x1[CARD_IDX_IDX], "newly minted card has wrong index");
		assert.equal(accounts[0], card0x1[CARD_OWNER_IDX], "newly minted card has wrong owner address");
	});
	it("mint: mint few cards and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		assert.equal(0x1, await card.collections(accounts[0], 0), accounts[0] + " collection doesn't contain card 0x1");
		assert.equal(0x2, await card.collections(accounts[0], 1), accounts[0] + " collection doesn't contain card 0x2");
		assert.equal(0x3, await card.collections(accounts[0], 2), accounts[0] + " collection doesn't contain card 0x3");
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 3);});

		const card0x1 = await card.cards(0x1);
		const card0x2 = await card.cards(0x2);
		const card0x3 = await card.cards(0x3);

		assert.equal(0x1, card0x1[CARD_ID_IDX], "newly minted card 0x1 has wrong id");
		assert.equal(0x2, card0x2[CARD_ID_IDX], "newly minted card 0x2 has wrong id");
		assert.equal(0x3, card0x3[CARD_ID_IDX], "newly minted card 0x3 has wrong id");
		assert.equal(0, card0x1[CARD_IDX_IDX], "newly minted card 0x1 has wrong index");
		assert.equal(1, card0x2[CARD_IDX_IDX], "newly minted card 0x2 has wrong index");
		assert.equal(2, card0x3[CARD_IDX_IDX], "newly minted card 0x3 has wrong index");
		assert.equal(accounts[0], card0x1[CARD_OWNER_IDX], "newly minted card 0x1 has wrong owner address");
		assert.equal(accounts[0], card0x2[CARD_OWNER_IDX], "newly minted card 0x2 has wrong owner address");
		assert.equal(accounts[0], card0x3[CARD_OWNER_IDX], "newly minted card 0x3 has wrong owner address");
	});
	it("mint: impossible to mint the same card twice", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.mint(accounts[0], 0x1);});
	});
	it("mint: impossible to mint a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(0, 0x1);});
	});
	it("mint: impossible to mint a card to a card smart contract itself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(card.address, 0x1);});
	});
	it("mint: impossible to mint a card without ROLE_CARD_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint.sendTransaction(accounts[1], 0x1, {from: accounts[1]});});
	});
	it("mint: minting a card requires ROLE_CARD_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.mint.sendTransaction(accounts[1], 0x1, {from: accounts[1]});
	});
	it("mint: impossible to mint a card with zero ID", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(accounts[0], 0x0)});
	});

	it("mintWith: mint a card with rarity and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mintWith(accounts[0], 0x401, 32);
		await card.mintWith(accounts[0], 0x402, 16);
		await card.mintWith(accounts[0], 0x403, 10);
		await card.mintWith(accounts[0], 0x404, 7);
		await card.mintWith(accounts[0], 0x405, 5);
		assert.equal(0x401, await card.collections(accounts[0], 0), accounts[0] + " card collection doesn't contain minted card");
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 5);});

		const card1 = await card.cards(0x401);
		const card2 = await card.cards(0x402);
		const card3 = await card.cards(0x403);
		const card4 = await card.cards(0x404);
		const card5 = await card.cards(0x405);

		assert.equal(0x401, card1[CARD_ID_IDX], "newly minted card 1 has wrong id");
		assert.equal(0, card1[CARD_IDX_IDX], "newly minted card 1 has wrong index");
		assert.equal(accounts[0], card1[CARD_OWNER_IDX], "newly minted card 1 has wrong owner address");
		assert.equal(32, card1[RARITY_IDX], "newly minted card 1 has wrong rarity value");
		assert.equal(0xFFFFFFFF, card1[ATTRIBUTES_IDX], "newly minted card 1 has wrong attributes");
		assert.equal(16, card2[RARITY_IDX], "newly minted card 2 has wrong rarity value");
		assert.equal(0xFFFF, card2[ATTRIBUTES_IDX], "newly minted card 2 has wrong attributes");
		assert.equal(10, card3[RARITY_IDX], "newly minted card 3 has wrong rarity value");
		assert.equal(0x03FF, card3[ATTRIBUTES_IDX], "newly minted card 3 has wrong attributes");
		assert.equal(7, card4[RARITY_IDX], "newly minted card 4 has wrong rarity value");
		assert.equal(0x7F, card4[ATTRIBUTES_IDX], "newly minted card 4 has wrong attributes");
		assert.equal(5, card5[RARITY_IDX], "newly minted card 5 has wrong rarity value");
		assert.equal(0x1F, card5[ATTRIBUTES_IDX], "newly minted card 5 has wrong attributes");
	});
	it("mintWith: impossible to mint a card with zero ID", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mintWith(accounts[0], 0x0, 3)});
	});

	it("mintCards: batch mint few cards", async function() {
		const card = await CharacterCard.new();
		await card.mintCards(accounts[0], [0x000103, 0x000203, 0x000303]);
		assert.equal(3, await card.balanceOf(accounts[0]), "wrong balance after minting 3 cards");
	});
	it("mintCards: structures integrity check after batch mint", async function() {
		const card = await CharacterCard.new();
		await card.mintCards(accounts[0], [0x000103, 0x000203, 0x000303]);
		const card0x1 = await card.cards(0x1);
		const card0x2 = await card.cards(0x2);
		const card0x3 = await card.cards(0x3);

		assert.equal(0x1, await card.collections(accounts[0], 0), "card 0x1 is missing in the collection at idx 0");
		assert.equal(0x2, await card.collections(accounts[0], 1), "card 0x2 is missing in the collection at idx 1");
		assert.equal(0x3, await card.collections(accounts[0], 2), "card 0x3 is missing in the collection at idx 2");
		assert.equal(0x1, card0x1[CARD_ID_IDX], "wrong card 0x1 ID after batch mint");
		assert.equal(0x2, card0x2[CARD_ID_IDX], "wrong card 0x2 ID after batch mint");
		assert.equal(0x3, card0x3[CARD_ID_IDX], "wrong card 0x3 ID after batch mint");
		assert.equal(0, card0x1[CARD_IDX_IDX], "wrong card 0x1 index after batch mint");
		assert.equal(1, card0x2[CARD_IDX_IDX], "wrong card 0x2 index after batch mint");
		assert.equal(2, card0x3[CARD_IDX_IDX], "wrong card 0x3 index after batch mint");
		assert.equal(accounts[0], card0x1[CARD_OWNER_IDX], "wrong card 0x1 owner after batch mint");
		assert.equal(accounts[0], card0x2[CARD_OWNER_IDX], "wrong card 0x2 owner after batch mint");
		assert.equal(accounts[0], card0x3[CARD_OWNER_IDX], "wrong card 0x3 owner after batch mint");
	});
	it("mintCards: batch mint requires sender to have ROLE_CARD_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_CARD_CREATOR);
		await card.mintCards.sendTransaction(
			accounts[0], [0x000103, 0x000203, 0x000303], {from: accounts[1]}
		);
	});
	it("mintCards: impossible to batch mint cards without ROLE_CARD_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards.sendTransaction(
				accounts[0], [0x000103, 0x000203, 0x000303], {from: accounts[1]}
			);
		});
	});
	it("mintCards: impossible to batch mint to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(0, [0x000103, 0x000203, 0x000303]);
		});
	});
	it("mintCards: impossible to batch mint to a card smart contract itself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(card.address, [0x000103, 0x000203, 0x000303]);
		});
	});
	it("mintCards: impossible to batch mint empty array of cards", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(accounts[0], []);
		});
	});
	it("mintCards: impossible to batch mint a card with zero ID", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(card.address, [0x000003, 0x000103, 0x000203]);
		});
	});

	it("transferCard: transfer a card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.transferCard(accounts[1], 0x1);
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x1), "card 0x1 has wrong owner after transferring it to " + accounts[1]);
	});
	it("transferCard: data structures integrity check after card transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		await card.mint(accounts[0], 0x4);
		await card.mint(accounts[0], 0x5);
		await card.transferCard(accounts[1], 0x2); // [1, 2, 3, 4, 5], [] -> [1, 5, 3, 4], [2]
		assert.equal(4, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after card transfer");
		assert.equal(0x5, await card.collections(accounts[0], 1), "wrong card ID in the collection idx 1 after transfer");
		assert.equal(1, (await card.cards(0x5))[CARD_IDX_IDX], "shifted card 0x5 has wrong index in the collection");
		assert.equal(0, (await card.cards(0x2))[CARD_IDX_IDX], "transferred card 0x2 has wrong index in the collection");
		await card.transferCard(accounts[1], 0x1); // [1, 5, 3, 4], [2] -> [4, 5, 3], [2, 1]
		assert.equal(3, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after 2 card transfers");
		assert.equal(0x4, await card.collections(accounts[0], 0), "wrong card ID in the collection idx 0 after second transfer");
		assert.equal(0, (await card.cards(0x4))[CARD_IDX_IDX], "shifted card 0x4 has wrong index in the collection");
		assert.equal(1, (await card.cards(0x1))[CARD_IDX_IDX], "second transferred card 0x1 has wrong index in the collection");
		await card.transferCard(accounts[1], 0x3); // [4, 5, 3], [2, 1] -> [4, 5], [2, 1, 3]
		await card.transferCard(accounts[1], 0x5); // [4, 5], [2, 1, 3] -> [4], [2, 1, 3, 5]
		await card.transferCard(accounts[1], 0x4); // [4], [2, 1, 3, 5] -> [], [2, 1, 3, 5, 4]
		assert.equal(0, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after all card transfers");
		assert.equal(0x2, await card.collections(accounts[1], 0), "wrong card ID in the collection idx 0 after all transfers");
		assert.equal(0x1, await card.collections(accounts[1], 1), "wrong card ID in the collection idx 1 after all transfers");
		assert.equal(0x3, await card.collections(accounts[1], 2), "wrong card ID in the collection idx 2 after all transfers");
		assert.equal(0x5, await card.collections(accounts[1], 3), "wrong card ID in the collection idx 3 after all transfers");
		assert.equal(0x4, await card.collections(accounts[1], 4), "wrong card ID in the collection idx 4 after all transfers");
		assert.equal(1, (await card.cards(0x1))[CARD_IDX_IDX], "card 0x1 has wrong index after all transfers");
		assert.equal(0, (await card.cards(0x2))[CARD_IDX_IDX], "card 0x2 has wrong index after all transfers");
		assert.equal(2, (await card.cards(0x3))[CARD_IDX_IDX], "card 0x3 has wrong index after all transfers");
		assert.equal(4, (await card.cards(0x4))[CARD_IDX_IDX], "card 0x4 has wrong index after all transfers");
		assert.equal(3, (await card.cards(0x5))[CARD_IDX_IDX], "card 0x5 has wrong index after all transfers");
	});
	it("transferCard: impossible to transfer a card which you do not own", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.transferCard(accounts[2], 0x1);});
	});
	it("transferCard: impossible to transfer a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.transferCard(0, 0x1);});
	});
	it("transferCard: impossible to transfer a card to oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.transferCard(accounts[0], 0x1);});
	});
	it("transferCard: approval revokes after card transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[2], 0x1);
		await card.transferCard(accounts[1], 0x1);
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer")
	});

	it("transferCardFrom: transfer own card without any approvals", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.transferCardFrom(accounts[0], accounts[1], 0x1);
		assert.equal(accounts[1], await card.ownerOf(0x1), "card 0x1 has wrong owner after transferring it");
	});
	it("transferCardFrom: transfer a card on behalf (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.transferCardFrom.sendTransaction(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x1), "wrong card 0x1 owner after transferring to " + accounts[1]);
	});
	it("transferCardFrom: transfer a card on behalf (operator approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approve(accounts[1], 1);
		await card.transferCardFrom(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(accounts[1], await card.ownerOf(0x1), "wrong card 0x1 owner after transferring to " + accounts[1]);
	});
	it("transferCardFrom: transfer a card on behalf (both single card and operator approvals)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.approve(accounts[1], 1);
		await card.transferCardFrom(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer")
	});
	it("transferCardFrom: impossible to transfer card on behalf without approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {
			await card.transferCardFrom.sendTransaction(accounts[0], accounts[1], 0x1, {from: accounts[1]});
		});
	});
	it("transferCardFrom: impossible to transfer non-existent card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.transferCardFrom.sendTransaction(accounts[0], accounts[1], 0x1);
		});
	});
	it("transferCardFrom: operator approval can be exhausted (spent)", async function() {
		const card = await CharacterCard.new();
		await card.approve(accounts[0], 1, {from: accounts[1]});
		assert.equal(1, await card.allowance(accounts[1], accounts[0]), "wrong approval left value after it was set to 1");
		await card.mint(accounts[1], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.transferCardFrom(accounts[1], accounts[0], 0x1);
		assert.equal(0, await card.allowance(accounts[1], accounts[0]), "wrong approval left value after transfer on behalf");
		await assertThrowsAsync(async function() {await card.transferCardFrom(accounts[1], accounts[0], 0x2);});
	});
	it("transferCardFrom: approval revokes after card transfer on behalf", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[2], 0x1);
		await card.transferCardFrom(accounts[0], accounts[1], 0x1, {from: accounts[2]});
		assert.equal(0, await card.approvals(0x1), "card 0x1 still has an approval after the transfer on behalf")
	});

	it("ERC20 transfer: it is possible to execute ERC20 compliant transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		await card.transfer(accounts[1], 3);
		assert.equal(0, await card.balanceOf(accounts[0]), "wrong source balance after ERC20 transfer");
		assert.equal(3, await card.balanceOf(accounts[1]), "wrong destination balance after ERC20 transfer");
	});
	it("ERC20 transfer: data structures integrity check after transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		await card.mint(accounts[1], 0x8);
		await card.mint(accounts[1], 0x9);
		await card.transfer(accounts[1], 3);
		assert.equal(0, await card.balanceOf(accounts[0]), "wrong source balance after transfer");
		assert.equal(5, await card.balanceOf(accounts[1]), "wrong destination balance after transfer");
		assert.equal(0x1, await card.collections(accounts[1], 2), "card 0x1 is missing in the collection at idx 2 after transfer");
		assert.equal(0x2, await card.collections(accounts[1], 3), "card 0x2 is missing in the collection at idx 3 after transfer");
		assert.equal(0x3, await card.collections(accounts[1], 4), "card 0x3 is missing in the collection at idx 4 after transfer");

		const card0x1 = await card.cards(0x1);
		const card0x2 = await card.cards(0x2);
		const card0x3 = await card.cards(0x3);

		assert.equal(0x1, card0x1[CARD_ID_IDX], "wrong card 0x1 ID after transfer");
		assert.equal(0x2, card0x2[CARD_ID_IDX], "wrong card 0x2 ID after transfer");
		assert.equal(0x3, card0x3[CARD_ID_IDX], "wrong card 0x3 ID after transfer");
		assert.equal(2, card0x1[CARD_IDX_IDX], "wrong card 0x1 index in the dst collection after transfer");
		assert.equal(3, card0x2[CARD_IDX_IDX], "wrong card 0x2 index in the dst collection after transfer");
		assert.equal(4, card0x3[CARD_IDX_IDX], "wrong card 0x3 index in the dst collection after transfer");
		assert(card0x1[CARD_OWN_MOD_IDX] > 0, "wrong card 0x1 ownership modified date after transfer");
		assert(card0x2[CARD_OWN_MOD_IDX] > 0, "wrong card 0x2 ownership modified date after transfer");
		assert(card0x3[CARD_OWN_MOD_IDX] > 0, "wrong card 0x3 ownership modified date after transfer");
		assert.equal(accounts[1], card0x1[CARD_OWNER_IDX], "wrong card 0x1 owner after the transfer");
		assert.equal(accounts[1], card0x2[CARD_OWNER_IDX], "wrong card 0x2 owner after the transfer");
		assert.equal(accounts[1], card0x3[CARD_OWNER_IDX], "wrong card 0x3 owner after the transfer");
	});
	it("ERC20 transfer: impossible to transfer more cards then the balance", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		await assertThrowsAsync(async function() {await card.transfer(accounts[1], 4)});
	});
	it("ERC20 transfer: impossible to transfer less cards then the balance", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.mint(accounts[0], 0x3);
		await assertThrowsAsync(async function() {await card.transfer(accounts[1], 2)});
	});
	it("ERC20 transfer: impossible to transfer to a zero address", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await assertThrowsAsync(async function() {await card.transfer(0, 2);});
	});
	it("ERC20 transfer: impossible to transfer to oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await assertThrowsAsync(async function() {await card.transfer(accounts[0], 2);});
	});

	it("ERC20 transferFrom: transfer own cards without any approvals", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await card.transferFrom(accounts[0], accounts[1], 2);
		assert.equal(2, await card.balanceOf(accounts[1]));
	});
	it("ERC20 transferFrom: transfer on behalf", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.approve.sendTransaction(accounts[2], 2, {from: accounts[1]});
		await card.transferFrom.sendTransaction(accounts[1], accounts[0], 2, {from: accounts[2]});
		assert.equal(2, await card.balanceOf(accounts[0]));
	});
	it("ERC20 transferFrom: impossible to transfer on behalf without approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await card.mint(accounts[1], 0x2);
		await assertThrowsAsync(async function() {
			await card.transferFrom.sendTransaction(accounts[1], accounts[0], 2, {from: accounts[2]});
		});
	});
	it("ERC20 transferFrom: impossible to transfer on behalf with not enough approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.mint(accounts[1], 0x3);
		await card.approve.sendTransaction(accounts[2], 2, {from: accounts[1]});
		await assertThrowsAsync(async function() {
			await card.transferFrom.sendTransaction(accounts[1], accounts[0], 3, {from: accounts[2]});
		});
	});

	it("approveCard: newly created card is not approved to be transferred initially", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		assert.equal(0, await card.approvals(0x1), "initial approval state for card 0x1 is wrong")
	});
	it("approveCard: approve an address (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[1], 0x1);
		assert.equal(accounts[1], await card.approvals(0x1), "approval state for card 0x1 is wrong")
	});
	it("approveCard: revoke an approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.revokeApproval(0x1);
		assert.equal(0, await card.approvals(0x1), "approval state after revoking for card 0x1 is wrong")
	});
	it("approveCard: impossible to approve another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.approveCard(accounts[0], 0x1);});
	});
	it("approveCard: impossible to revoke approval of another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await card.approveCard.sendTransaction(accounts[0], 0x1, {from: accounts[1]});
		await assertThrowsAsync(async function() {await card.revokeApproval(0x1);});
	});
	it("approveCard: impossible to approve non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approveCard(accounts[1], 0x1);});
	});
	it("approveCard: impossible to revoke an approval if it doesn't exist", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.revokeApproval(0x1);});
	});
	it("approveCard: impossible to approve oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.approveCard(accounts[0], 0x1);});
	});
	it("approveCard: approval toggling (normal scenario)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.approveCard(0, 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.approveCard(0, 0x1);
	});
	it("approveCard: approval toggling (wrong scenario)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.approveCard(0, 0x1);});
		await card.approveCard(accounts[1], 0x1);
		await card.approveCard(accounts[1], 0x1);
		await card.approveCard(0, 0x1);
		await assertThrowsAsync(async function() {await card.approveCard(0, 0x1);});
	});

	it("approve: create operator", async function() {
		const card = await CharacterCard.new();
		await card.approve(accounts[1], 1);
		assert.equal(1, await card.allowance(accounts[0], accounts[1]), "wrong approvals left value after it was set to 1");
	});
	it("setApprovalForAll: create an operator with unlimited approvals", async function() {
		const card = await CharacterCard.new();
		await card.setApprovalForAll(accounts[1], true);

		// check the result is greater then zero
		assert(await card.allowance(accounts[0], accounts[1]) > 0, "approvals left must be greater then zero");

		// check the value set is indeed maximum possible uint256
		const maxUint256 = web3.toBigNumber("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
		const approvalsLeft = await card.allowance(accounts[0], accounts[1]);
		assert(maxUint256.eq(approvalsLeft), "approvals left must be set to maximum uint256");
	});
	it("approve: impossible to approve oneself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approve(accounts[0], 1);});
	});
	it("approve: impossible to approve zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approve(0, 1);});
	});

	it("collections: iterate over the collection of cards", async function() {
		const card = await CharacterCard.new();
		const N = 13;
		for(let i = 1; i <= N; i++) {
			await card.mint(accounts[0], i);
		}
		assert.equal(N, await card.balanceOf(accounts[0]), "wrong initial balance");
		for(let i = 0; i < N; i++) {
			const cardId = await card.collections(accounts[0], i);
			assert.equal(i + 1, cardId, "wrong card ID at pos " + i);
			const c = await card.cards(cardId);
			assert.equal(cardId.toNumber(), c[CARD_ID_IDX], "wrong card.id in card " + i);
			assert.equal(i, c[CARD_IDX_IDX], "wrong card.index in card " + i);
			assert.equal(accounts[0], c[CARD_OWNER_IDX], "wrong card.owner in card " + i)
		}
	});

	it("card updates: set attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 7);
		assert.equal(7, await card.getAttributes(0x1), "wrong attributes for card 0x1");
	});
	it("card updates: add attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 1);
		await card.addAttributes(0x1, 2);
		assert.equal(3, await card.getAttributes(0x1), "wrong attributes for card 0x1");
	});
	it("card updates: remove attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.setAttributes(0x1, 7);
		await card.removeAttributes(0x1, 2);
		assert.equal(5, await card.getAttributes(0x1), "wrong attributes for card 0x1");
	});
	it("card updates: setting attributes requires ROLE_COMBAT_PROVIDER permissions", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.addOperator(accounts[1], ROLE_COMBAT_PROVIDER);
		await card.setAttributes.sendTransaction(0x1, 7, {from: accounts[1]});
		await card.addAttributes.sendTransaction(0x1, 1, {from: accounts[1]});
		await card.removeAttributes.sendTransaction(0x1, 2, {from: accounts[1]});
		assert.equal(5, await card.getAttributes(0x1), "wrong attributes for card 0x1");
	});
	it("card updates: impossible to set/add/remove attributes of non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setAttributes(0x1, 7);});
		await assertThrowsAsync(async function() {await card.addAttributes(0x1, 7);});
		await assertThrowsAsync(async function() {await card.removeAttributes(0x1, 7);});
	});
	it("card updates: impossible to set/add/remove attributes without a permission", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x1);
		await assertThrowsAsync(async function() {await card.setAttributes.sendTransaction(0x1, 7, {from: accounts[1]});});
		await assertThrowsAsync(async function() {await card.addAttributes.sendTransaction(0x1, 7, {from: accounts[1]});});
		await assertThrowsAsync(async function() {await card.removeAttributes.sendTransaction(0x1, 7, {from: accounts[1]});});
	});

	it("card locking: it is possible to lock a card", async function () {
		const card = await CharacterCard.new();
		await card.setLockedBitmask(0x8000);
		assert.equal(0x8000, await card.lockedBitmask(), "`lockedBitmask` was not set");
		await card.mint(accounts[0], 0x1);
		await card.setState(0x1, 0x8000);
		assert.equal(0x8000, await card.getState(0x1), "card 0x1 has wrong state");
	});
	it("card locking: impossible to lock non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setState(0x1, 0x8000);});
	});
	it("card locking: impossible to lock a card without a permission", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.setState.sendTransaction(0x1, 0x8000, {from: accounts[1]});});
	});
	it("card locking: impossible to transfer a locked card", async function() {
		const card = await CharacterCard.new();
		await card.setLockedBitmask(0x8000);
		await card.mint(accounts[0], 0x1);
		await card.setState(0x1, 0x8000);
		await assertThrowsAsync(async function() {await card.transferCard(accounts[1], 0x1);});
	});
	it("card locking: impossible to set lockedBitmask without ROLE_COMBAT_PROVIDER permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setLockedBitmask.sendTransaction(0x8000, {from: accounts[1]});});
	});

	it("battle: it is possible to play a game", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);
		assert.equal(1, (await card.cards(0x1))[GAMES_PLAYED_IDX], "card 0x1 games played counter is incorrect");
		assert.equal(1, (await card.cards(0x2))[GAMES_PLAYED_IDX], "card 0x2 games played counter is incorrect");
	});
	it("battle: game counters are stored correctly", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_VICTORY); // card1 won card2

		const card0x1V = await card.cards(0x1);
		const card0x2V = await card.cards(0x2);
		assert.equal(1, card0x1V[GAMES_PLAYED_IDX], "card 0x1 games played counter is incorrect");
		assert.equal(1, card0x1V[WINS_COUNT_IDX], "card 0x1 wins counter is incorrect");
		assert.equal(0, card0x1V[LOSSES_COUNT_IDX], "card 0x1 losses counter is incorrect");
		assert.equal(1, card0x2V[GAMES_PLAYED_IDX], "card 0x2 games played counter is incorrect");
		assert.equal(0, card0x2V[WINS_COUNT_IDX], "card 0x2 wins counter is incorrect");
		assert.equal(1, card0x2V[LOSSES_COUNT_IDX], "card 0x2 losses counter is incorrect");
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DEFEAT); // card1 lost card2

		const card0x1D = await card.cards(0x1);
		const card0x2D = await card.cards(0x2);
		assert.equal(2, card0x1D[GAMES_PLAYED_IDX], "card 0x1 games played counter is incorrect");
		assert.equal(1, card0x1D[WINS_COUNT_IDX], "card 0x1 wins counter is incorrect");
		assert.equal(1, card0x1D[LOSSES_COUNT_IDX], "card 0x1 losses counter is incorrect");
		assert.equal(2, card0x2D[GAMES_PLAYED_IDX], "card 0x2 games played counter is incorrect");
		assert.equal(1, card0x2D[WINS_COUNT_IDX], "card 0x2 wins counter is incorrect");
		assert.equal(1, card0x2D[LOSSES_COUNT_IDX], "card 0x2 losses counter is incorrect");
	});
	it("battle: last game outcome is GAME_OUTCOME_UNDEFINED initially", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		const state = await card.getState(0x1);
		const outcome = LAST_GAME_OUTCOME_BITS & state;
		assert.equal(GAME_OUTCOME_UNDEFINED, outcome, "initial game outcome for any card must be GAME_OUTCOME_UNDEFINED");
	});
	it("battle: last game outcome is stored correctly", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);
		let state1 = await card.getState(0x1);
		let state2 = await card.getState(0x2);
		let outcome1 = LAST_GAME_OUTCOME_BITS & state1;
		let outcome2 = LAST_GAME_OUTCOME_BITS & state2;
		assert.equal(GAME_OUTCOME_DRAW, outcome1, "card 0x1 last game outcome is incorrect");
		assert.equal(GAME_OUTCOME_DRAW, outcome2, "card 0x1 last game outcome is incorrect");
	});
	it("battle: last game outcome is updated correctly", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);
		let state1 = await card.getState(0x1);
		let state2 = await card.getState(0x2);
		let outcome1 = LAST_GAME_OUTCOME_BITS & state1;
		let outcome2 = LAST_GAME_OUTCOME_BITS & state2;
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_VICTORY);
		state1 = await card.getState(0x1);
		state2 = await card.getState(0x2);
		outcome1 = LAST_GAME_OUTCOME_BITS & state1;
		outcome2 = LAST_GAME_OUTCOME_BITS & state2;
		assert.equal(GAME_OUTCOME_VICTORY, outcome1, "card 0x1 last game outcome is incorrect (2nd game)");
		assert.equal(GAME_OUTCOME_DEFEAT, outcome2, "card 0x1 last game outcome is incorrect (2nd game)");
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DEFEAT);
		state1 = await card.getState(0x1);
		state2 = await card.getState(0x2);
		outcome1 = LAST_GAME_OUTCOME_BITS & state1;
		outcome2 = LAST_GAME_OUTCOME_BITS & state2;
		assert.equal(GAME_OUTCOME_DEFEAT, outcome1, "card 0x1 last game outcome is incorrect (3d game)");
		assert.equal(GAME_OUTCOME_VICTORY, outcome2, "card 0x1 last game outcome is incorrect (3d game)");
	});
	it("battle: impossible to play a card game with oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[0], 0x2);
		await assertThrowsAsync(async function() {await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);});
	});
	it("battle: impossible to play a card game with one non-existent card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await assertThrowsAsync(async function() {await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);});
		await assertThrowsAsync(async function() {await card.battleComplete(0x2, 0x1, GAME_OUTCOME_DRAW);});
	});
	it("battle: impossible to play a card game with both non-existent cards", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.battleComplete(0x1, 0x2, GAME_OUTCOME_DRAW);});
		await assertThrowsAsync(async function() {await card.battleComplete(0x2, 0x1, GAME_OUTCOME_DRAW);});
	});
	it("battle: impossible to update card battle without ROLE_COMBAT_PROVIDER permission", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await assertThrowsAsync(async function() {await card.battleComplete.sendTransaction(0x1, 0x2, GAME_OUTCOME_DRAW, {from: accounts[1]});});
	});
	it("battle: ROLE_COMBAT_PROVIDER permission is enough to update card battle", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.addOperator(accounts[1], ROLE_COMBAT_PROVIDER);
		await card.battleComplete.sendTransaction(0x1, 0x2, GAME_OUTCOME_DRAW, {from: accounts[1]});
		assert.equal(1, (await card.cards(0x1))[GAMES_PLAYED_IDX], "card 0x1 games played counter is incorrect");
		assert.equal(1, (await card.cards(0x2))[GAMES_PLAYED_IDX], "card 0x2 games played counter is incorrect");
	});

	it("battle: batch update", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);

		await card.battlesComplete(0x1, 0x2, 149999, 50001, 299999, GAME_OUTCOME_VICTORY);

		// check the results
		const card0x1 = await card.cards(0x1);
		const card0x2 = await card.cards(0x2);
		assert(299999, card0x1[GAMES_PLAYED_IDX], "card 0x1 has wrong total games played counter");
		assert(299999, card0x2[GAMES_PLAYED_IDX], "card 0x2 has wrong total games played counter");
		assert(149999, card0x1[WINS_COUNT_IDX], "card 0x1 has wrong wins counter");
		assert( 50001, card0x2[WINS_COUNT_IDX], "card 0x2 has wrong wins counter");
		assert( 50001, card0x1[LOSSES_COUNT_IDX], "card 0x1 has wrong losses counter");
		assert(149999, card0x2[LOSSES_COUNT_IDX], "card 0x2 has wrong losses counter");
	});
	it("battle: impossible to batch update if gamesPlayed is zero", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);

		// check it throws if gamesPlayed is zero
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 0, 0, 0, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: impossible to batch update if wins + loses is greater then gamesPlayed", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);

		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 1, 1, 1, GAME_OUTCOME_VICTORY);
		});
	});
	it("battle: impossible to batch update if lastGameOutcome is inconsistent with wins/losses", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);

		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 0, 1, 1, GAME_OUTCOME_VICTORY);
		});
		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 1, 0, 1, GAME_OUTCOME_DEFEAT);
		});
		// check it throws if wins + loses is greater then gamesPlayed
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 1, 0, 1, GAME_OUTCOME_DRAW);
		});
	});
	it("battle: arithmetic overflow check in input parameters", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);

		// check arithmetic overflow on wins
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 4294967295, 1, 1, GAME_OUTCOME_VICTORY);
		});
		// check arithmetic overflow on losses
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 1, 4294967295, 1, GAME_OUTCOME_VICTORY);
		});
	});
	it("battle: arithmetic overflow check on card state", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x1);
		await card.mint(accounts[1], 0x2);
		await card.mint(accounts[2], 0x3);

		await card.battlesComplete(0x1, 0x2, 1, 4294967294, 4294967295, GAME_OUTCOME_VICTORY);

		// check arithmetic overflow on gamesPlayed card1
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x1, 0x2, 1, 0, 1, GAME_OUTCOME_VICTORY);
		});

		// check arithmetic overflow on gamesPlayed card2
		await assertThrowsAsync(async function() {
			await card.battlesComplete(0x3, 0x2, 1, 0, 1, GAME_OUTCOME_VICTORY);
		});
	});

	it("getCard: check initial card integrity", async function() {
		const card = await CharacterCard.new();
		await card.mintWith(accounts[0], 0x1, 3);
		const tuple = await card.getCard(0x1);
		const creationTime = shiftAndTrim(tuple[0], 224, 32);
		const rarity = shiftAndTrim(tuple[0], 192, 32);
		const attributesModified = shiftAndTrim(tuple[0], 160, 32);
		const attributes =  shiftAndTrim(tuple[0], 128, 32);
		const lastGamePlayed = shiftAndTrim(tuple[0], 96, 32);
		const gamesPlayed = shiftAndTrim(tuple[0], 64, 32);
		const wins = shiftAndTrim(tuple[0], 32, 32);
		const losses = shiftAndTrim(tuple[0], 0, 32);
		const id = shiftAndTrim(tuple[1], 240, 16);
		const index = shiftAndTrim(tuple[1], 224, 16);
		const state = shiftAndTrim(tuple[1], 192, 32);
		const ownershipModified = shiftAndTrim(tuple[1], 160, 32);
		const address = shiftAndTrim(tuple[1], 0, 160);
		assert(creationTime > 0, "card 0x1 has zero creation time");
		assert.equal(3, rarity, "card 0x1 has wrong rarity: " + rarity);
		assert.equal(0, attributesModified, "card 0x1 has non-zero attributes modified date");
		assert.equal(0x7, attributes, "card 0x1 has wrong attributes: " + attributes);
		assert.equal(0, lastGamePlayed, "card 0x1 has non-zero last game played date" + lastGamePlayed);
		assert.equal(0, gamesPlayed, "card 0x1 has non-zero games played counter");
		assert.equal(0, wins, "card 0x1 has non-zero wins counter");
		assert.equal(0, losses, "card 0x1 has non-zero losses counter");
		assert.equal(1, id, "card 0x1 has wrong id: " + id);
		assert.equal(0, index, "card 0x1 has non-zero index");
		assert.equal(0, state, "card 0x1 has wrong state: " + state);
		assert.equal(0, ownershipModified, "card 0x1 has non-zero ownership modified date");
		assert.equal(accounts[0], address, "card 0x1 has wrong owner: " + address);
	});
	it("getCard: check cards integrity after playing a game", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x10);
		await card.mintWith(accounts[0], 0x1, 0xF);
		await card.mint(accounts[1], 0x2);
		await card.battleComplete(0x1, 0x2, GAME_OUTCOME_VICTORY);
		const tuple = await card.getCard(0x1);
		const creationTime = shiftAndTrim(tuple[0], 224, 32);
		const rarity = shiftAndTrim(tuple[0], 192, 32);
		const attributesModified = shiftAndTrim(tuple[0], 160, 32);
		const attributes =  shiftAndTrim(tuple[0], 128, 32);
		const lastGamePlayed = shiftAndTrim(tuple[0], 96, 32);
		const gamesPlayed = shiftAndTrim(tuple[0], 64, 32);
		const wins = shiftAndTrim(tuple[0], 32, 32);
		const losses = shiftAndTrim(tuple[0], 0, 32);
		const id = shiftAndTrim(tuple[1], 240, 16);
		const index = shiftAndTrim(tuple[1], 224, 16);
		const state = shiftAndTrim(tuple[1], 192, 32);
		const ownershipModified = shiftAndTrim(tuple[1], 160, 32);
		const address = shiftAndTrim(tuple[1], 0, 160);
		assert(creationTime > 0, "card 0x1 has zero creation time");
		assert.equal(0xF, rarity, "card 0x1 has wrong rarity: " + rarity);
		assert.equal(0x7FFF, attributes, "card 0x1 has wrong attributes: " + attributes);
		assert.equal(0, attributesModified, "card 0x1 has non-zero attributes modified date");
		assert(lastGamePlayed > 0, "card 0x1 has zero last game played date");
		assert.equal(1, gamesPlayed, "card 0x1 has wrong games played counter: " + gamesPlayed);
		assert.equal(1, wins, "card 0x1 has wrong wins counter: " + wins);
		assert.equal(0, losses, "card 0x1 has non-zero losses counter");
		assert.equal(1, id, "card 0x1 has wrong id: " + id);
		assert.equal(1, index, "card 0x1 has wrong index: " + index);
		assert.equal(3, state, "card 0x1 has wrong state: " + state);
		assert.equal(0, ownershipModified, "card 0x1 has non-zero ownership modified date");
		assert.equal(accounts[0], address, "card 0x1 has wrong owner: " + address);
	});

});

// equal to `number >> n & (1 << k) - 1` but works with BigNumber
// TODO: refactor using BigNumber arithmetic, throwing away the k % 8 == 0 requirement
function shiftAndTrim(number, n, k) {
	if(n < 0) {
		throw "n must not be negative!";
	}
	if(k <= 0) {
		throw "k must be positive";
	}
	if(k % 8 !== 0) {
		throw "k must be multiple of 8!";
	}

	number = binaryShift(number, n);


	number = number.toString(16);
	const octNum = k / 8;
	const padLen = 2 * octNum - number.length;
	if(padLen > 0) {
		for(let i = 0; i < padLen; i++) {
			number = "0" + number;
		}
	}
	number = number.substr(number.length - 2 * octNum, 2 * octNum);

	return "0x" + number;
}

// equal to number >> n if n is positive,
// number << -n if n is negative
function binaryShift(number, n) {
	const e = web3.toBigNumber(2).pow(Math.abs(n));
	if(n > 0) {
		number = number.dividedToIntegerBy(e);
	}
	else if(n < 0) {
		number = number.multipledBy(e);
	}
	return number;
}

// ensures actualRole has requestedRole
function hasRole(actualRole, requestedRole) {
	return (actualRole & requestedRole) == requestedRole;
}

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
