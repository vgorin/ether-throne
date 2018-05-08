// npm install truffle-hdwallet-provider
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
	networks: {
		development: {
			provider: new HDWalletProvider(
				"goddess bundle miss dance loop arm want life asthma leader coin describe",
				"https://rinkeby.infura.io/9A7EpV9S7shj1LWKy1s2"
			),
			network_id: "*", // Match any network (determined by provider)
			gas: 7000000,
			gasPrice: 20000000000 // 20 GWei
		},
		// https://www.npmjs.com/package/solidity-coverage
		coverage: {
			host: "localhost",
			network_id: "*",
			port: 8555,
			gas: 0xfffffffffff,
			gasPrice: 0x01
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
