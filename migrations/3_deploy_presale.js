const Card = artifacts.require("./CharacterCard");
const Presale = artifacts.require("./Presale");

module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[deploy presale] test network - skipping the migration script");
		return;
	}
	if(network === "coverage") {
		console.log("[deploy presale] coverage network - skipping the migration script");
		return;
	}

	const cardInstance = await Card.deployed();

	await deployer.deploy(
		Presale,
		cardInstance.address,
		'0x2f4Fe9f655FF9316335D7200169Cd07d598ff7BC'
	);
};
