const Card = artifacts.require("./CharacterCard");
const Presale = artifacts.require("./Presale");

module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[release presale] test network - skipping the migration script");
		return;
	}
	if(network === "coverage") {
		console.log("[release presale] coverage network - skipping the migration script");
		return;
	}

	const cardInstance = await Card.deployed();
	const presaleInstance = await Presale.deployed();

	await cardInstance.addOperator(presaleInstance.address, 0x00000002);


	console.log("___________________________________________________");
	console.log("card:    " + cardInstance.address);
	console.log("presale: " + presaleInstance.address);
};
