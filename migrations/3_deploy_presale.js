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

	const presaleInstance = await Presale.deployed();

	await cardInstance.addOperator(presaleInstance.address, 0x00000002);

	console.log("___________________________________________________");
	console.log("card:    " + cardInstance.address);
	console.log("presale: " + presaleInstance.address);
};
