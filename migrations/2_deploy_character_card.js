module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[deploy character card] test network - skipping the migration script");
		return;
	}

	const Card = artifacts.require("./CharacterCard");
	await deployer.deploy(Card);
};
