module.exports = async function(deployer, network, accounts) {
	if(network === "test") {
		console.log("[deploy presale] test network - skipping the migration script");
		return;
	}

	const Presale = artifacts.require("./Presale");
	await deployer.deploy(
		Presale,
		'0xc968972bb379a70773b9caee646f9e4edd3fd547',
		'0x2f4Fe9f655FF9316335D7200169Cd07d598ff7BC'
	);
};
