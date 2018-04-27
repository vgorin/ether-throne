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
			gasPrice: 200000000000 // 200 GWei
		},
	}
};
