/* START: Loom Network Configuration */
const { readFileSync } = require('fs');
const LoomTruffleProvider = require('loom-truffle-provider');

const chainId    = 'default';
const writeUrl   = 'http://127.0.0.1:46658/rpc';
const readUrl    = 'http://127.0.0.1:46658/query';
const privateKey = readFileSync('./private_key', 'utf-8');

const loomTruffleProvider = new LoomTruffleProvider(chainId, writeUrl, readUrl, privateKey);

/* END: Loom Network Configuration */

// npm install truffle-hdwallet-provider
const HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
	networks: {
		loom_dapp_chain: {
			provider: loomTruffleProvider,
			network_id: '*'
		},
		development: {
			provider: new HDWalletProvider(
				"12 mimic words",
				"https://rinkeby.infura.io/***key***"
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
			gasPrice: 1
		},
		test: {
			host: "localhost",
			network_id: "*",
			port: 8666,
			gas: 7000000,
			gasPrice: 1
		}
	},
	mocha: {
		enableTimeouts: false
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
