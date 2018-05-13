// role constants copied from AccessControl.sol as is
const ROLE_ATTR_PROVIDER = 0x00100000;
const ROLE_STATE_PROVIDER = 0x00200000;
const ROLE_ROLE_MANAGER = 0x10000000;

// role constants copied from CharacterCard.sol as is
const ROLE_TOKEN_CREATOR = 0x00040000;

// character card structure definitions
const ATTRIBUTES_IDX = 1;
const CARD_ID_IDX = 5;
const CARD_IDX_IDX = 6;
const CARD_OWN_MOD_IDX = 7;
const CARD_OWNER_IDX = 8;

const CharacterCard = artifacts.require("./CharacterCard.sol");

contract('CharacterCard', function(accounts) {
	it("initial state", async function() {
		const card = await CharacterCard.new();
		assert.equal(0, await card.totalSupply(), "initial totalSupply must be zero");
		assert.equal(0, await card.balanceOf(accounts[0]), "initial card balance must be zero");
		assert(!await card.exists(0x401), "card 0x401 should not exist initially");
		await assertThrowsAsync(async function() {await card.ownerOf(0x401);});
		await assertThrowsAsync(async function() {await card.getCard(0x401);});
		await assertThrowsAsync(async function() {await card.getState(0x401);});
		await assertThrowsAsync(async function() {await card.getAttributes(0x401);});
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 0);});
	});

	it("roles: creator has full privileges", async function() {
		const card = await CharacterCard.new();
		assert(await card.userRoles(accounts[0]) > 0, accounts[0] + " must have full privileges, but it doesn't");
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
	it("roles: newly added operator role doesn't have more permissions then its creator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER | 0x1);
		await card.addOperator.sendTransaction(accounts[2], 0x3, {from: accounts[1]});
		assert.equal(0x1, await card.userRoles(accounts[2]), accounts[2] + " must have 0x1 permission only");
	});
	it("roles: remove operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], 0x1);
		assert(await card.userRoles(accounts[1]) > 0, accounts[1] + " must be an operator but its not");
		await card.removeOperator(accounts[1]);
		assert.equal(0, await card.userRoles(accounts[1]), accounts[1] + " must not be an operator but it is");
	});
	it("roles: operator removes another operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], 0x1);
		assert(await card.userRoles(accounts[2]) > 0, accounts[2] + " must be an operator but its not");
		await card.removeOperator.sendTransaction(accounts[2], {from: accounts[1]});
		assert.equal(0, await card.userRoles(accounts[2]), accounts[2] + " must not be an operator but it is");
	});
	it("roles: impossible to add more powerful operator", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_ROLE_MANAGER);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_TOKEN_CREATOR, {from: account[1]});
		});
	});
	it("roles: impossible to add an operator without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addOperator.sendTransaction(accounts[2], ROLE_TOKEN_CREATOR, {from: accounts[1]});
		});
	});
	it("roles: impossible to remove an operator without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.addOperator(accounts[2], ROLE_TOKEN_CREATOR);
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
	it("roles: ROLE_TOKEN_CREATOR role is enough to mint a card", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.mint.sendTransaction(accounts[1], 0x401, {from: accounts[1]});
		assert.equal(1, await card.totalSupply(), "card was not minted, totalSupply is not 1");
		assert.equal(1, await card.balanceOf(accounts[1]), "card was not minted, balanceOf " + accounts[1] + " is not 1");
		assert(await card.exists(0x401), "card was not minted, card 0x401 doesn't exist");
	});
	it("roles: operator cannot remove himself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.removeOperator(accounts[0]);});
	});

	it("permissions: add role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.addRole(accounts[1], ROLE_STATE_PROVIDER);
		assert(hasRole(await card.userRoles(accounts[1]), ROLE_STATE_PROVIDER), "role ROLE_COMBAT_PROVIDER was not added");
	});
	it("permissions: remove role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR | ROLE_STATE_PROVIDER);
		assert(hasRole(await card.userRoles(accounts[1]), ROLE_STATE_PROVIDER), "role ROLE_COMBAT_PROVIDER must be enabled initially");
		await card.removeRole(accounts[1], ROLE_STATE_PROVIDER);
		assert(!hasRole(await card.userRoles(accounts[1]), ROLE_STATE_PROVIDER), "role ROLE_COMBAT_PROVIDER was not removed");
	});
	it("permissions: impossible to add role without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.addOperator(accounts[2], ROLE_STATE_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_TOKEN_CREATOR, {from: accounts[1]});
		});
	});
	it("permissions: impossible to remove role without ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR | ROLE_STATE_PROVIDER);
		await card.addOperator(accounts[2], ROLE_TOKEN_CREATOR | ROLE_STATE_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.removeRole.sendTransaction(accounts[2], ROLE_STATE_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: impossible to remove role which caller doesn't have", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_TOKEN_CREATOR | ROLE_STATE_PROVIDER);
		await assertThrowsAsync(async function() {
			await card.removeRole.sendTransaction(accounts[2], ROLE_STATE_PROVIDER, {from: accounts[1]});
		});
	});
	it("permissions: add role using ROLE_ROLE_MANAGER permission", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_STATE_PROVIDER);
		await card.addRole.sendTransaction(accounts[2], ROLE_TOKEN_CREATOR, {from: accounts[1]});
		assert(hasRole(await card.userRoles(accounts[2]), ROLE_TOKEN_CREATOR), "role ROLE_CARD_CREATOR was not added");
	});
	it("permissions: impossible to add role using user without same role", async function() {
		const card = await CharacterCard.new();
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR | ROLE_ROLE_MANAGER);
		await card.addOperator(accounts[2], ROLE_TOKEN_CREATOR);
		await assertThrowsAsync(async function() {
			await card.addRole.sendTransaction(accounts[2], ROLE_STATE_PROVIDER, {from: accounts[1]});
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
		await card.mint(accounts[0], 0x401);
		assert.equal(1, await card.totalSupply(), "totalSupply after minting a card must be 1");
		assert.equal(1, await card.balanceOf(accounts[0]), "card balance after minting a card must be 1");
		assert(await card.exists(0x401), "card 0x401 doesn't exist after minting");
		assert.equal(accounts[0], await card.ownerOf(0x401), "card 0x401 has wrong owner after minting it to " + accounts[0]);
	});
	it("mint: mint a card and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		assert.equal(0x401, await card.collections(accounts[0], 0), accounts[0] + " card collection doesn't contain minted card");
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 1);});

		const card1 = await card.cards(0x401);

		assert.equal(0x401, card1[CARD_ID_IDX], "newly minted card has wrong id");
		assert.equal(0, card1[CARD_IDX_IDX], "newly minted card has wrong index");
		assert.equal(accounts[0], card1[CARD_OWNER_IDX], "newly minted card has wrong owner address");
	});
	it("mint: mint few cards and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		assert.equal(0x401, await card.collections(accounts[0], 0), accounts[0] + " collection doesn't contain card 0x401");
		assert.equal(0x402, await card.collections(accounts[0], 1), accounts[0] + " collection doesn't contain card 0x402");
		assert.equal(0x403, await card.collections(accounts[0], 2), accounts[0] + " collection doesn't contain card 0x403");
		await assertThrowsAsync(async function() {await card.collections(accounts[0], 3);});

		const card1 = await card.cards(0x401);
		const card2 = await card.cards(0x402);
		const card3 = await card.cards(0x403);

		assert.equal(0x401, card1[CARD_ID_IDX], "newly minted card 0x401 has wrong id");
		assert.equal(0x402, card2[CARD_ID_IDX], "newly minted card 0x402 has wrong id");
		assert.equal(0x403, card3[CARD_ID_IDX], "newly minted card 0x403 has wrong id");
		assert.equal(0, card1[CARD_IDX_IDX], "newly minted card 0x401 has wrong index");
		assert.equal(1, card2[CARD_IDX_IDX], "newly minted card 0x402 has wrong index");
		assert.equal(2, card3[CARD_IDX_IDX], "newly minted card 0x403 has wrong index");
		assert.equal(accounts[0], card1[CARD_OWNER_IDX], "newly minted card 0x401 has wrong owner address");
		assert.equal(accounts[0], card2[CARD_OWNER_IDX], "newly minted card 0x402 has wrong owner address");
		assert.equal(accounts[0], card3[CARD_OWNER_IDX], "newly minted card 0x403 has wrong owner address");
	});
	it("mint: impossible to mint the same card twice", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.mint(accounts[0], 0x401);});
	});
	it("mint: impossible to mint a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(0, 0x401);});
	});
	it("mint: impossible to mint a card to a card smart contract itself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(card.address, 0x401);});
	});
	it("mint: minting a card requires ROLE_TOKEN_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint.sendTransaction(accounts[1], 0x401, {from: accounts[1]});});
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.mint.sendTransaction(accounts[1], 0x401, {from: accounts[1]});
	});
	it("mint: impossible to mint a card with zero ID", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mint(accounts[0], 0x0)});
	});

	it("mintWith: mint a card with attributes and check integrity of the structures involved", async function() {
		const card = await CharacterCard.new();
		await card.mintWith(accounts[0], 0x401, (1 << 32) - 1);
		await card.mintWith(accounts[0], 0x402, (1 << 16) - 1);
		await card.mintWith(accounts[0], 0x403, (1 << 10) - 1);
		await card.mintWith(accounts[0], 0x404, (1 << 7) - 1);
		await card.mintWith(accounts[0], 0x405, (1 << 5) - 1);
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
		// assert.equal(0xFFFFFFFF, card1[ATTRIBUTES_IDX], "newly minted card 1 has wrong attributes");
		assert.equal(0xFFFF, card2[ATTRIBUTES_IDX], "newly minted card 2 has wrong attributes");
		assert.equal(0x03FF, card3[ATTRIBUTES_IDX], "newly minted card 3 has wrong attributes");
		assert.equal(0x7F, card4[ATTRIBUTES_IDX], "newly minted card 4 has wrong attributes");
		assert.equal(0x1F, card5[ATTRIBUTES_IDX], "newly minted card 5 has wrong attributes");
	});
	it("mintWith: impossible to mint a card with zero ID", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.mintWith(accounts[0], 0x0, (1 << 3) - 1)});
	});

	it("mintCards: batch mint few cards", async function() {
		const card = await CharacterCard.new();
		await card.mintCards(accounts[0], [0x040103, 0x040203, 0x040303]);
		assert.equal(3, await card.balanceOf(accounts[0]), "wrong balance after minting 3 cards");
	});
	it("mintCards: structures integrity check after batch mint", async function() {
		const card = await CharacterCard.new();
		await card.mintCards(accounts[0], [0x040103, 0x040203, 0x040303]);
		const card1 = await card.cards(0x401);
		const card2 = await card.cards(0x402);
		const card3 = await card.cards(0x403);

		assert.equal(0x401, await card.collections(accounts[0], 0), "card 0x401 is missing in the collection at idx 0");
		assert.equal(0x402, await card.collections(accounts[0], 1), "card 0x402 is missing in the collection at idx 1");
		assert.equal(0x403, await card.collections(accounts[0], 2), "card 0x403 is missing in the collection at idx 2");
		assert.equal(0x401, card1[CARD_ID_IDX], "wrong card 0x401 ID after batch mint");
		assert.equal(0x402, card2[CARD_ID_IDX], "wrong card 0x402 ID after batch mint");
		assert.equal(0x403, card3[CARD_ID_IDX], "wrong card 0x403 ID after batch mint");
		assert.equal(0, card1[CARD_IDX_IDX], "wrong card 0x401 index after batch mint");
		assert.equal(1, card2[CARD_IDX_IDX], "wrong card 0x402 index after batch mint");
		assert.equal(2, card3[CARD_IDX_IDX], "wrong card 0x403 index after batch mint");
		assert.equal(accounts[0], card1[CARD_OWNER_IDX], "wrong card 0x401 owner after batch mint");
		assert.equal(accounts[0], card2[CARD_OWNER_IDX], "wrong card 0x402 owner after batch mint");
		assert.equal(accounts[0], card3[CARD_OWNER_IDX], "wrong card 0x403 owner after batch mint");
	});
	it("mintCards: batch mint requires sender to have ROLE_TOKEN_CREATOR permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards.sendTransaction(
				accounts[0], [0x040103, 0x040203, 0x040303], {from: accounts[1]}
			);
		});
		await card.addOperator(accounts[1], ROLE_TOKEN_CREATOR);
		await card.mintCards.sendTransaction(
			accounts[0], [0x040103, 0x040203, 0x040303], {from: accounts[1]}
		);
	});
	it("mintCards: impossible to batch mint to a zero address", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(0, [0x040103, 0x040203, 0x040303]);
		});
	});
	it("mintCards: impossible to batch mint to a card smart contract itself", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.mintCards(card.address, [0x040103, 0x040203, 0x040303]);
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
			await card.mintCards(card.address, [0x040003, 0x040103, 0x040203]);
		});
	});

	it("transferToken: transfer a card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.transferToken(accounts[1], 0x401);
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x401), "card 0x401 has wrong owner after transferring it to " + accounts[1]);
	});
	it("transferToken: data structures integrity check after card transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		await card.mint(accounts[0], 0x404);
		await card.mint(accounts[0], 0x405);
		await card.transferToken(accounts[1], 0x402); // [1, 2, 3, 4, 5], [] -> [1, 5, 3, 4], [2]
		assert.equal(4, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after card transfer");
		assert.equal(0x405, await card.collections(accounts[0], 1), "wrong card ID in the collection idx 1 after transfer");
		assert.equal(1, (await card.cards(0x405))[CARD_IDX_IDX], "shifted card 0x5 has wrong index in the collection");
		assert.equal(0, (await card.cards(0x402))[CARD_IDX_IDX], "transferred card 0x402 has wrong index in the collection");
		await card.transferToken(accounts[1], 0x401); // [1, 5, 3, 4], [2] -> [4, 5, 3], [2, 1]
		assert.equal(3, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after 2 card transfers");
		assert.equal(0x404, await card.collections(accounts[0], 0), "wrong card ID in the collection idx 0 after second transfer");
		assert.equal(0, (await card.cards(0x404))[CARD_IDX_IDX], "shifted card 0x4 has wrong index in the collection");
		assert.equal(1, (await card.cards(0x401))[CARD_IDX_IDX], "second transferred card 0x401 has wrong index in the collection");
		await card.transferToken(accounts[1], 0x403); // [4, 5, 3], [2, 1] -> [4, 5], [2, 1, 3]
		await card.transferToken(accounts[1], 0x405); // [4, 5], [2, 1, 3] -> [4], [2, 1, 3, 5]
		await card.transferToken(accounts[1], 0x404); // [4], [2, 1, 3, 5] -> [], [2, 1, 3, 5, 4]
		assert.equal(0, await card.balanceOf(accounts[0]), accounts[0] + "has wrong balance after all card transfers");
		assert.equal(0x402, await card.collections(accounts[1], 0), "wrong card ID in the collection idx 0 after all transfers");
		assert.equal(0x401, await card.collections(accounts[1], 1), "wrong card ID in the collection idx 1 after all transfers");
		assert.equal(0x403, await card.collections(accounts[1], 2), "wrong card ID in the collection idx 2 after all transfers");
		assert.equal(0x405, await card.collections(accounts[1], 3), "wrong card ID in the collection idx 3 after all transfers");
		assert.equal(0x404, await card.collections(accounts[1], 4), "wrong card ID in the collection idx 4 after all transfers");
		assert.equal(1, (await card.cards(0x401))[CARD_IDX_IDX], "card 0x401 has wrong index after all transfers");
		assert.equal(0, (await card.cards(0x402))[CARD_IDX_IDX], "card 0x402 has wrong index after all transfers");
		assert.equal(2, (await card.cards(0x403))[CARD_IDX_IDX], "card 0x403 has wrong index after all transfers");
		assert.equal(4, (await card.cards(0x404))[CARD_IDX_IDX], "card 0x404 has wrong index after all transfers");
		assert.equal(3, (await card.cards(0x405))[CARD_IDX_IDX], "card 0x405 has wrong index after all transfers");
	});
	it("transferToken: impossible to transfer a card which you do not own", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await assertThrowsAsync(async function() {await card.transferToken(accounts[2], 0x401);});
	});
	it("transferToken: impossible to transfer a card to a zero address", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.transferToken(0, 0x401);});
	});
	it("transferToken: impossible to transfer a card to oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.transferToken(accounts[0], 0x401);});
	});
	it("transferToken: approval revokes after card transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[2], 0x401);
		await card.transferToken(accounts[1], 0x401);
		assert.equal(0, await card.approvals(0x401), "card 0x401 still has an approval after the transfer")
	});

	it("transferTokenFrom: transfer own card without any approvals", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.transferTokenFrom(accounts[0], accounts[1], 0x401);
		assert.equal(accounts[1], await card.ownerOf(0x401), "card 0x401 has wrong owner after transferring it");
	});
	it("transferTokenFrom: transfer a card on behalf (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.transferTokenFrom.sendTransaction(accounts[0], accounts[1], 0x401, {from: accounts[1]});
		assert.equal(0, await card.balanceOf(accounts[0]), "sender's card balance after transferring a card must be 0");
		assert.equal(1, await card.balanceOf(accounts[1]), "receiver's card balance after transferring a card must be 1");
		assert.equal(accounts[1], await card.ownerOf(0x401), "wrong card 0x401 owner after transferring to " + accounts[1]);
	});
	it("transferTokenFrom: transfer a card on behalf (operator approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approve(accounts[1], 1);
		await card.transferTokenFrom(accounts[0], accounts[1], 0x401, {from: accounts[1]});
		assert.equal(accounts[1], await card.ownerOf(0x401), "wrong card 0x401 owner after transferring to " + accounts[1]);
	});
	it("transferTokenFrom: transfer a card on behalf (both single card and operator approvals)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.approve(accounts[1], 1);
		await card.transferTokenFrom(accounts[0], accounts[1], 0x401, {from: accounts[1]});
		assert.equal(0, await card.approvals(0x401), "card 0x401 still has an approval after the transfer")
	});
	it("transferTokenFrom: impossible to transfer card on behalf without approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {
			await card.transferTokenFrom.sendTransaction(accounts[0], accounts[1], 0x401, {from: accounts[1]});
		});
	});
	it("transferTokenFrom: impossible to transfer non-existent card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {
			await card.transferTokenFrom.sendTransaction(accounts[0], accounts[1], 0x401);
		});
	});
	it("transferTokenFrom: operator approval can be exhausted (spent)", async function() {
		const card = await CharacterCard.new();
		await card.approve(accounts[0], 1, {from: accounts[1]});
		assert.equal(1, await card.allowance(accounts[1], accounts[0]), "wrong approval left value after it was set to 1");
		await card.mint(accounts[1], 0x401);
		await card.mint(accounts[1], 0x402);
		await card.transferTokenFrom(accounts[1], accounts[0], 0x401);
		assert.equal(0, await card.allowance(accounts[1], accounts[0]), "wrong approval left value after transfer on behalf");
		await assertThrowsAsync(async function() {await card.transferTokenFrom(accounts[1], accounts[0], 0x402);});
	});
	it("transferTokenFrom: approval revokes after card transfer on behalf", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[2], 0x401);
		await card.transferTokenFrom(accounts[0], accounts[1], 0x401, {from: accounts[2]});
		assert.equal(0, await card.approvals(0x401), "card 0x401 still has an approval after the transfer on behalf")
	});

	it("ERC20 transfer: it is possible to execute ERC20 compliant transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		await card.transfer(accounts[1], 3);
		assert.equal(0, await card.balanceOf(accounts[0]), "wrong source balance after ERC20 transfer");
		assert.equal(3, await card.balanceOf(accounts[1]), "wrong destination balance after ERC20 transfer");
	});
	it("ERC20 transfer: data structures integrity check after transfer", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		await card.mint(accounts[1], 0x408);
		await card.mint(accounts[1], 0x409);
		await card.transfer(accounts[1], 3);
		assert.equal(0, await card.balanceOf(accounts[0]), "wrong source balance after transfer");
		assert.equal(5, await card.balanceOf(accounts[1]), "wrong destination balance after transfer");
		assert.equal(0x401, await card.collections(accounts[1], 2), "card 0x401 is missing in the collection at idx 2 after transfer");
		assert.equal(0x402, await card.collections(accounts[1], 3), "card 0x402 is missing in the collection at idx 3 after transfer");
		assert.equal(0x403, await card.collections(accounts[1], 4), "card 0x403 is missing in the collection at idx 4 after transfer");

		const card1 = await card.cards(0x401);
		const card2 = await card.cards(0x402);
		const card3 = await card.cards(0x403);

		assert.equal(0x401, card1[CARD_ID_IDX], "wrong card 0x401 ID after transfer");
		assert.equal(0x402, card2[CARD_ID_IDX], "wrong card 0x402 ID after transfer");
		assert.equal(0x403, card3[CARD_ID_IDX], "wrong card 0x403 ID after transfer");
		assert.equal(2, card1[CARD_IDX_IDX], "wrong card 0x401 index in the dst collection after transfer");
		assert.equal(3, card2[CARD_IDX_IDX], "wrong card 0x402 index in the dst collection after transfer");
		assert.equal(4, card3[CARD_IDX_IDX], "wrong card 0x403 index in the dst collection after transfer");
		assert(card1[CARD_OWN_MOD_IDX] > 0, "wrong card 0x401 ownership modified date after transfer");
		assert(card2[CARD_OWN_MOD_IDX] > 0, "wrong card 0x402 ownership modified date after transfer");
		assert(card3[CARD_OWN_MOD_IDX] > 0, "wrong card 0x403 ownership modified date after transfer");
		assert.equal(accounts[1], card1[CARD_OWNER_IDX], "wrong card 0x401 owner after the transfer");
		assert.equal(accounts[1], card2[CARD_OWNER_IDX], "wrong card 0x402 owner after the transfer");
		assert.equal(accounts[1], card3[CARD_OWNER_IDX], "wrong card 0x403 owner after the transfer");
	});
	it("ERC20 transfer: impossible to transfer more cards then the balance", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		await assertThrowsAsync(async function() {await card.transfer(accounts[1], 4)});
	});
	it("ERC20 transfer: impossible to transfer less cards then the balance", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.mint(accounts[0], 0x403);
		await assertThrowsAsync(async function() {await card.transfer(accounts[1], 2)});
	});
	it("ERC20 transfer: impossible to transfer to a zero address", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await assertThrowsAsync(async function() {await card.transfer(0, 2);});
	});
	it("ERC20 transfer: impossible to transfer to oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await assertThrowsAsync(async function() {await card.transfer(accounts[0], 2);});
	});

	it("ERC20 transferFrom: transfer own cards without any approvals", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.mint(accounts[0], 0x402);
		await card.transferFrom(accounts[0], accounts[1], 2);
		assert.equal(2, await card.balanceOf(accounts[1]));
	});
	it("ERC20 transferFrom: transfer on behalf", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await card.mint(accounts[1], 0x402);
		await card.approve.sendTransaction(accounts[2], 2, {from: accounts[1]});
		await card.transferFrom.sendTransaction(accounts[1], accounts[0], 2, {from: accounts[2]});
		assert.equal(2, await card.balanceOf(accounts[0]));
	});
	it("ERC20 transferFrom: impossible to transfer on behalf without approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await card.mint(accounts[1], 0x402);
		await assertThrowsAsync(async function() {
			await card.transferFrom.sendTransaction(accounts[1], accounts[0], 2, {from: accounts[2]});
		});
	});
	it("ERC20 transferFrom: impossible to transfer on behalf with not enough approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await card.mint(accounts[1], 0x402);
		await card.mint(accounts[1], 0x403);
		await card.approve.sendTransaction(accounts[2], 2, {from: accounts[1]});
		await assertThrowsAsync(async function() {
			await card.transferFrom.sendTransaction(accounts[1], accounts[0], 3, {from: accounts[2]});
		});
	});

	it("approveToken: newly created card is not approved to be transferred initially", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		assert.equal(0, await card.approvals(0x401), "initial approval state for card 0x401 is wrong")
	});
	it("approveToken: approve an address (single card approval)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[1], 0x401);
		assert.equal(accounts[1], await card.approvals(0x401), "approval state for card 0x401 is wrong")
	});
	it("approveToken: revoke an approval", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.revokeApproval(0x401);
		assert.equal(0, await card.approvals(0x401), "approval state after revoking for card 0x401 is wrong")
	});
	it("approveToken: impossible to approve another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await assertThrowsAsync(async function() {await card.approveToken(accounts[0], 0x401);});
	});
	it("approveToken: impossible to revoke approval of another's owner card", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await card.approveToken.sendTransaction(accounts[0], 0x401, {from: accounts[1]});
		await assertThrowsAsync(async function() {await card.revokeApproval(0x401);});
	});
	it("approveToken: impossible to approve non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.approveToken(accounts[1], 0x401);});
	});
	it("approveToken: impossible to revoke an approval if it doesn't exist", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await assertThrowsAsync(async function() {await card.revokeApproval(0x401);});
	});
	it("approveToken: impossible to approve oneself", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.approveToken(accounts[0], 0x401);});
	});
	it("approveToken: approval toggling (normal scenario)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.approveToken(0, 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.approveToken(0, 0x401);
	});
	it("approveToken: approval toggling (wrong scenario)", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.approveToken(0, 0x401);});
		await card.approveToken(accounts[1], 0x401);
		await card.approveToken(accounts[1], 0x401);
		await card.approveToken(0, 0x401);
		await assertThrowsAsync(async function() {await card.approveToken(0, 0x401);});
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
			await card.mint(accounts[0], 0x400 + i);
		}
		assert.equal(N, await card.balanceOf(accounts[0]), "wrong initial balance");
		for(let i = 0; i < N; i++) {
			const cardId = await card.collections(accounts[0], i);
			assert.equal(i + 0x401, cardId, "wrong card ID at pos " + i);
			const cardI = await card.cards(cardId);
			assert.equal(cardId.toNumber(), cardI[CARD_ID_IDX], "wrong card.id in card " + i);
			assert.equal(i, cardI[CARD_IDX_IDX], "wrong card.index in card " + i);
			assert.equal(accounts[0], cardI[CARD_OWNER_IDX], "wrong card.owner in card " + i)
		}
	});

	it("card updates: set attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.setAttributes(0x401, 7);
		assert.equal(7, await card.getAttributes(0x401), "wrong attributes for card 0x401");
	});
	it("card updates: add attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.setAttributes(0x401, 1);
		await card.addAttributes(0x401, 2);
		assert.equal(3, await card.getAttributes(0x401), "wrong attributes for card 0x401");
	});
	it("card updates: remove attributes", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await card.setAttributes(0x401, 7);
		await card.removeAttributes(0x401, 2);
		assert.equal(5, await card.getAttributes(0x401), "wrong attributes for card 0x401");
	});
	it("card updates: setting attributes requires ROLE_ATTR_PROVIDER permissions", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.setAttributes.sendTransaction(0x401, 7, {from: accounts[1]});});
		await card.addOperator(accounts[1], ROLE_ATTR_PROVIDER);
		await card.setAttributes.sendTransaction(0x401, 7, {from: accounts[1]});
		await card.addAttributes.sendTransaction(0x401, 1, {from: accounts[1]});
		await card.removeAttributes.sendTransaction(0x401, 2, {from: accounts[1]});
		assert.equal(5, await card.getAttributes(0x401), "wrong attributes for card 0x401");
	});
	it("card updates: impossible to set/add/remove attributes of non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setAttributes(0x401, 7);});
		await assertThrowsAsync(async function() {await card.addAttributes(0x401, 7);});
		await assertThrowsAsync(async function() {await card.removeAttributes(0x401, 7);});
	});
	it("card updates: impossible to set/add/remove attributes without a permission", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[1], 0x401);
		await assertThrowsAsync(async function() {await card.setAttributes.sendTransaction(0x401, 7, {from: accounts[1]});});
		await assertThrowsAsync(async function() {await card.addAttributes.sendTransaction(0x401, 7, {from: accounts[1]});});
		await assertThrowsAsync(async function() {await card.removeAttributes.sendTransaction(0x401, 7, {from: accounts[1]});});
	});

	it("card locking: it is possible to lock a card", async function () {
		const card = await CharacterCard.new();
		await card.setLockedBitmask(0x8000);
		assert.equal(0x8000, await card.lockedBitmask(), "`lockedBitmask` was not set");
		await card.mint(accounts[0], 0x401);
		await card.setState(0x401, 0x8000);
		assert.equal(0x8000, await card.getState(0x401), "card 0x401 has wrong state");
	});
	it("card locking: impossible to lock non-existing card", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setState(0x401, 0x8000);});
	});
	it("card locking: impossible to lock a card without a permission", async function() {
		const card = await CharacterCard.new();
		await card.mint(accounts[0], 0x401);
		await assertThrowsAsync(async function() {await card.setState.sendTransaction(0x401, 0x8000, {from: accounts[1]});});
	});
	it("card locking: impossible to transfer a locked card", async function() {
		const card = await CharacterCard.new();
		await card.setLockedBitmask(0x8000);
		await card.mint(accounts[0], 0x401);
		await card.setState(0x401, 0x8000);
		await assertThrowsAsync(async function() {await card.transferToken(accounts[1], 0x401);});
	});
	it("card locking: impossible to set lockedBitmask without ROLE_COMBAT_PROVIDER permission", async function() {
		const card = await CharacterCard.new();
		await assertThrowsAsync(async function() {await card.setLockedBitmask.sendTransaction(0x8000, {from: accounts[1]});});
	});

	it("getPacked: check initial card integrity", async function() {
		const card = await CharacterCard.new();
		await card.mintWith(accounts[0], 0x401, (1 << 3) - 1);
		const tuple = await card.getPacked(0x401);
		const attributesModified = shiftAndTrim(tuple[0], 224, 32);
		const attributes =  shiftAndTrim(tuple[0], 160, 64);
		const stateModified = shiftAndTrim(tuple[0], 128, 32);
		const state = shiftAndTrim(tuple[0], 0, 128);
		const creationTime = shiftAndTrim(tuple[1], 224, 32);
		const id = shiftAndTrim(tuple[1], 208, 16);
		const index = shiftAndTrim(tuple[1], 192, 16);
		const ownershipModified = shiftAndTrim(tuple[1], 160, 32);
		const address = shiftAndTrim(tuple[1], 0, 160);
		assert.equal(0, attributesModified, "card 0x401 has non-zero attributes modified date");
		assert.equal(0x7, attributes, "card 0x401 has wrong attributes: " + attributes);
		assert.equal(0, stateModified, "card 0x401 has wrong state: " + stateModified);
		assert.equal(0, state, "card 0x401 has wrong state: " + state);
		assert(creationTime > 0, "card 0x401 has zero creation time");
		assert.equal(0x401, id, "card 0x401 has wrong id: " + id);
		assert.equal(0, index, "card 0x401 has non-zero index");
		assert.equal(0, ownershipModified, "card 0x401 has non-zero ownership modified date");
		assert.equal(accounts[0], address, "card 0x401 has wrong owner: " + address);
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
