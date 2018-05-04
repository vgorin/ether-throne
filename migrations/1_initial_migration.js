const Migrations = artifacts.require("./Migrations.sol");

module.exports = async function(deployer, network) {
	if(network === "test") {
		console.log("[initial migration] test network - skipping the migration script");
		return;
	}
	if(network === "coverage") {
		console.log("[initial migration] coverage network - skipping the migration script");
		return;
	}

	await deployer.deploy(Migrations);
};
