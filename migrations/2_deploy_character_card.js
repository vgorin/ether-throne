module.exports = async function(deployer, network, accounts) {
	const Card = artifacts.require("./CharacterCard");
	await deployer.deploy(Card);
};
