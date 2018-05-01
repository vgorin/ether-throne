const Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer, network) {
	if(network === "test") {
		console.log("[initial migration] test network - skipping the migration script");
		return;
	}

	deployer.deploy(Migrations);
};
