module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[release presale] test network - skipping the migration script");
		return;
	}

	const Card = artifacts.require("./CharacterCard");
	await Card.at('0xc968972bb379a70773b9caee646f9e4edd3fd547').addOperator('0x1363ea30b21bae713399d91265f62c561f94844a', 0x00000002);
};
