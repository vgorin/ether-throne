const Card = artifacts.require("./CharacterCard");

module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[deploy character card] test network - skipping the migration script");
		return;
	}
	if(network === "coverage") {
		console.log("[deploy character card] coverage network - skipping the migration script");
		return;
	}

	await deployer.deploy(Card);
};
