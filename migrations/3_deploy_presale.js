const Card = artifacts.require("./CharacterCard");
const Presale = artifacts.require("./Presale");
const Bitmaps = artifacts.require("./Bitmaps");

const ROLE_TOKEN_CREATOR = 0x00040000;

module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[deploy presale] test network - skipping the migration script");
		return;
	}
	if(network === "coverage") {
		console.log("[deploy presale] coverage network - skipping the migration script");
		return;
	}

	// get the deployed card instance from previous script - 2_deploy_character_card.js
	const cardInstance = await Card.deployed();
	await cardInstance.updateFeatures(0xFFFFFFFF);

	await deployer.deploy(Bitmaps);
	await deployer.link(Bitmaps, Presale);

	await deployer.deploy(
		Presale,
		cardInstance.address,
		'0x2f4Fe9f655FF9316335D7200169Cd07d598ff7BC'
	);
	const presaleInstance = await Presale.deployed();

	await cardInstance.addOperator(presaleInstance.address, ROLE_TOKEN_CREATOR);

	// init 4000 cards
	for(let i = 0; i < 8; i++) {
		await presaleInstance.init(512);
	}

	console.log("___________________________________________________");
	console.log("card:    " + cardInstance.address);
	console.log("presale: " + presaleInstance.address);
};
