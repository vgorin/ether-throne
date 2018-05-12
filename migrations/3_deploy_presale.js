const Card = artifacts.require("./CharacterCard");
const Presale = artifacts.require("./Presale");
const Bitmaps = artifacts.require("./Bitmaps");
const RandomSeq = artifacts.require("./RandomSeq");

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

	await deployer.deploy(Bitmaps);
	await deployer.link(Bitmaps, Presale);

	await deployer.deploy(RandomSeq);
	await deployer.link(RandomSeq, Presale);

	await deployer.deploy(
		Presale,
		cardInstance.address,
		'0x2f4Fe9f655FF9316335D7200169Cd07d598ff7BC'
	);
	const presaleInstance = await Presale.deployed();

	await cardInstance.addOperator(presaleInstance.address, ROLE_TOKEN_CREATOR);

	console.log("___________________________________________________");
	console.log("card:    " + cardInstance.address);
	console.log("presale: " + presaleInstance.address);
};
