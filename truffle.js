// npm install truffle-hdwallet-provider
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
	networks: {
		development: {
			provider: new HDWalletProvider(
				"goddess bundle miss dance loop arm want life asthma leader coin describe",
				"https://rinkeby.infura.io/9A7EpV9S7shj1LWKy1s2"
			),
			network_id: "3", // Match only Ropsten
			gas: 4700000,
			gasPrice: 20000000000 // 20 GWei
		},
	},
/*
	solc: {
		optimizer: {
			enabled: true,
			runs: 200 // default is 200, however for function execution the effect is noticeable up to 20000
		}
	}
*/
};
