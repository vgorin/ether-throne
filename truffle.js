// npm install truffle-hdwallet-provider
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
	networks: {
		development: {
			provider: new HDWalletProvider(
				"12 seed words, see https://freewallet.org/bip39-recovery-from-mnemonic-bitcoin-and-other-cryptocurrencies#english",
				"https://ropsten.infura.io/***key***"
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
