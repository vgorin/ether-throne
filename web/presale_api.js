/**
 *
 * @param cardAddr
 * @param presaleAddr
 * @param logger
 * @param jQuery_instance
 * @constructor
 */
function PresaleApi(cardAddr, presaleAddr, logger, jQuery_instance) {
	const CHAR_CARD_VERSION = 0xA;
	const PRESALE_VERSION = 0x4;
	const jQuery3 = jQuery_instance? jQuery_instance: jQuery;
	let myWeb3;
	let myAccount;
	let myNetwork;
	let cardInstance;
	let presaleInstance;

	function logError(msg) {
		console.error(msg);
		if(logger && logger.errorHandler) {
			logger.errorHandler(msg);
		}
	}

	function logInfo(msg) {
		console.log(msg);
	}

	function logSuccess(msg) {
		logInfo(msg);
		if(logger && logger.successHandler) {
			logger.successHandler(msg);
		}
	}

	function registerMintEventListener(cardInstance) {
		const mintEvent = cardInstance.Minted({_to: myAccount});
		mintEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving Minted event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args._by && receipt.args._to && receipt.args._tokenId)) {
				logError("Minted event received in wrong format: wrong arguments");
				return;
			}
			const by = receipt.args._by;
			const to = receipt.args._to;
			const cardId = receipt.args._tokenId.toString(10);
			logSuccess("Minted(" + by + ", " + to + ", " + cardId + ")");
		});
		logInfo("Successfully registered Minted(uint16, address, address) event listener");
	}

	function registerCardTransferEventListener(cardInstance) {
		const tokenTransferEvent = cardInstance.TokenTransfer();
		tokenTransferEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving ERC721 CardTransfer event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args._from && receipt.args._to && receipt.args._tokenId)) {
				logError("ERC721 CardTransfer event received in wrong format: wrong arguments");
				return;
			}
			const from = receipt.args._from;
			const to = receipt.args._to;
			const cardId = receipt.args._tokenId.toString(10);
			logInfo("ERC721 CardTransfer(" + from + ", " + to + ", " + cardId + ")");
		});
		logInfo("Successfully registered ERC721 CardTransfer(uint16, address, address) event listener");
	}

	function registerTransferEventListener(cardInstance) {
		const transferEvent = cardInstance.Transfer();
		transferEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving ERC20 Transfer event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args._from && receipt.args._to && receipt.args._value)) {
				logError("ERC20 Transfer event received in wrong format: wrong arguments");
				return;
			}
			const from = receipt.args._from;
			const to = receipt.args._to;
			const value = receipt.args._value.toString(10);
			logInfo("ERC20 Transfer(" + from + ", " + to + ", " + value + ")");
		});
		logInfo("Successfully registered ERC20 Transfer(address, address, uint16) event listener");
	}

	function registerBattleCompleteEventListener(cardInstance) {
		const battleCompleteEvent = cardInstance.BattleComplete();
		battleCompleteEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving BattleComplete event: " + err);
				return;
			}
			if(!(receipt && receipt.args
					&& receipt.args.card1Id
					&& receipt.args.card2Id
					&& receipt.args.gamesPlayed
					&& receipt.args.lastGameOutcome)) {
				logError("BattleComplete event received in wrong format: wrong arguments");
				return;
			}
			const card1Id = receipt.args.card1Id.toString(16);
			const card2Id = receipt.args.card2Id.toString(16);
			const wins = receipt.args.wins;
			const losses = receipt.args.losses;
			const gamesPlayed = receipt.args.gamesPlayed;
			const lastGameOutcome = receipt.args.lastGameOutcome;
			logInfo("BattleComplete(0x" + card1Id + ", 0x" + card2Id + ", " + wins + ", " + losses + ", " + gamesPlayed + ", " + lastGameOutcome + ")");
		});
		logInfo("Successfully registered BattleComplete(uint16, uint16, uint32, uint32, uint32, uint8) event listener");
	}

	function registerPurchaseCompleteEventListener(presaleInstance) {
		const purchaseCompleteEvent = presaleInstance.PurchaseComplete();
		purchaseCompleteEvent.watch(function(err, receipt) {
			// TODO: implement
		});
		logInfo("Successfully registered PurchaseComplete(address, address, uint16) event listener");
	}

	function loadCardsFor(cardInstance, myAccount) {
		cardInstance.balanceOf(myAccount, function(err, balance) {
			if(err) {
				logError("Unable to read card balance: " + err);
				cardInstance = null;
				return;
			}
			if(balance > 0) {
				logInfo("You own " + balance + " card(s):");
				for(let i = 0; i < balance; i++) {
					cardInstance.collections(myAccount, i, function(err, cardId) {
						if(err) {
							logError("Cannot load list of the cards");
							return;
						}
						cardInstance.getCard(cardId, function(err, card) {
							if(err) {
								logError("Cannot load card " + cardId);
								return;
							}
							logInfo("0x" + cardId.toString(16) + ": " + cardToString(card));
						})
					});
				}
			}
			else {
				logInfo("You don't own any cards");
			}
		});
	}

	function instanceLoaded() {
		if(cardInstance && presaleInstance) {
			logSuccess("Application loaded successfully.\nNetwork " + networkName(myNetwork));
		}
	}

	function networkName(network) {
		switch(network) {
			case "0": return "0: Olympic; Ethereum public pre-release testnet";
			case "1": return "1: Frontier; Homestead, Metropolis, the Ethereum public main network";
			case "2": return "2: Morden; The public Ethereum testnet, now Ethereum Classic testnet";
			case "3": return "3: Ropsten; The public cross-client Ethereum testnet";
			case "4": return "4: Rinkeby: The public Geth Ethereum testnet";
			case "42": return "42: Kovan; The public Parity Ethereum testnet";
			case "77": return "77: Sokol; The public POA testnet";
			case "99": return "99: POA; The public Proof of Authority Ethereum network";
			case "7762959": return "7762959: Musicoin; The music blockchain";
			default: return network + ": Unknown network";
		}
	}

	/**
	 * Initializes presale API.
	 * 	* Checks if Web3 is enabled (MetaMask installed) – synchronous
	 * 	* Checks if user account is accessible (MetaMask unlocked) - synchronous
	 * 	* Checks user balance (if its possible to submit transaction).
	 * 	* Loads Character Card ERC721 smart contract ABI
	 * 	* Connects to deployed Character Card ERC721 instance and checks its version
	 * 	* Loads Presale smart contract ABI
	 * 	* Connects to deployed Presale instance and checks its version
	 * After all checks are done, sets cardInstance and presaleInstance.
	 * If something goes wrong with Character Card smart contract initialization,
	 * cardInstance remains null
	 * If something goes wrong with Presale smart contract initialization,
	 * presaleInstance remains null
	 * @return {number} error code indicating some problems detected (sync only),
	 * 	* 0x1 MetaMask is not installed
	 * 	* 0x2 and 0x4 MetaMask is locked
	 */
	this.init = function() {
		if(typeof window.web3 == 'undefined') {
			logError("Web3 is not enabled. Do you need to install MetaMask?");
			return 0x1;
		}
		myWeb3 = new Web3(window.web3.currentProvider);
		myWeb3.eth.getAccounts(function(err, accounts) {
			if(err) {
				logError("getAccounts() error: " + err);
				return;
			}
			myAccount = accounts[0];
			myNetwork = myWeb3.version.network;
			if(!myAccount) {
				logError("Cannot access default account.\nIs MetaMask locked?");
				return;
			}
			logInfo("Web3 integration loaded. Your account is " + myAccount + ", network id " + networkName(myNetwork));
			myWeb3.eth.getBalance(myAccount, function(err, balance) {
				if(err) {
					logError("getBalance() error: " + err);
					return;
				}
				if(balance > 0) {
					logInfo("Your balance is " + myWeb3.fromWei(balance, 'ether'));
				}
				else {
					logError("Your balance is zero.\nYou won't be able to send any transaction.");
				}
				jQuery3.ajax({
					async: false,
					global: false,
					url: "abi/CharacterCard.json",
					dataType: "json",
					success: function(data, textStatus, jqXHR) {
						logInfo("Character Card ABI loaded successfully");
						const cardABI = myWeb3.eth.contract(data.abi);
						const instance = cardABI.at(cardAddr);
						try {
							instance.CHAR_CARD_VERSION(function(err, version) {
								if(err) {
									logError("Error accessing Character Card (ERC721) Instance: " + err + "\nCannot access CHAR_CARD_VERSION.");
									return;
								}
								if(CHAR_CARD_VERSION != version) {
									logError("Error accessing Character Card (ERC721) Instance: not a valid instance.\nCheck if the address specified points to an ERC721 instance with a valid CHAR_CARD_VERSION.\nVersion required: " + CHAR_CARD_VERSION + ". Version found: " + version);
									return;
								}
								logInfo("Successfully connected to Character Card (ERC721) Instance at " + cardAddr);
								registerMintEventListener(instance);
								// registerCardTransferEventListener(instance);
								// registerTransferEventListener(instance);
								// registerBattleCompleteEventListener(instance);
								// loadCards(instance, myAccount);
								cardInstance = instance;
								instanceLoaded();
							});
						}
						catch(err) {
							logError("Cannot access Character Card (ERC721) Instance: " + err);
						}
					},
					error: function(jqXHR, textStatus, errorThrown) {
						logError("Cannot load Character Card ABI: " + errorThrown);
					}
				});
				jQuery3.ajax({
					async: false,
					global: false,
					url: "abi/Presale.json",
					dataType: "json",
					success: function(data, textStatus, jqXHR) {
						logInfo("Presale ABI loaded successfully");
						const presaleABI = myWeb3.eth.contract(data.abi);
						const instance = presaleABI.at(presaleAddr);
						try {
							instance.PRESALE_VERSION(function(err, version) {
								if(err) {
									logError("Error accessing Presale Instance: " + err + "\nCannot access PRESALE_VERSION.");
									return;
								}
								if(PRESALE_VERSION != version) {
									logError("Error accessing Presale Instance: not a valid instance.\nCheck if the address specified points to a Presale instance with a valid PRESALE_VERSION.\nVersion required: " + PRESALE_VERSION + ". Version found: " + version);
									return;
								}
								logInfo("Successfully connected to Presale Instance at " + presaleAddr);
								presaleInstance = instance;
								instanceLoaded();
							});
						}
						catch(err) {
							logError("Cannot access Presale Instance: " + err);
						}
					},
					error: function(jqXHR, textStatus, errorThrown) {
						logError("Cannot load Presale ABI: " + errorThrown);
					}
				});
			});
		});

		return 0;
	};

	/**
	 * Prepares a Web3 transaction to buy a usual card,
	 * bound to a "BUY BEING (1)" button.
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 */
	this.buyUsual = function(idx, cardId) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x1;
		}
		presaleInstance.buyUsual.sendTransaction(idx, cardId, {value: myWeb3.toWei(250, 'finney')}, function(err, txHash) {
			if(err) {
				logError("Buy transaction wasn't sent: " + err.toString().split("\n")[0]);
				return;
			}
			logSuccess("Buy transaction sent: " + txHash);
		});
	};

	/**
	 * Prepares a Web3 transaction to buy a single card,
	 * bound to a "BUY BEING (1)" and "BUY BEING" buttons.
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 */
	this.buyRandom = function() {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x1;
		}
		presaleInstance.buyRandom.sendTransaction({value: myWeb3.toWei(50, 'finney')}, function(err, txHash) {
			if(err) {
				logError("Buy transaction wasn't sent: " + err.toString().split("\n")[0]);
				return;
			}
			logSuccess("Buy transaction sent: " + txHash);
		});
	};

	/**
	 * Prepares a Web3 transaction to buy 3 cards,
	 * bound to a "BUY BEING (3)" button
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 */
	this.buyRandom3 = function() {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x1;
		}
		presaleInstance.buyRandom.sendTransaction(
			{value: myWeb3.toBigNumber(myWeb3.toWei(50, 'finney')).times(2)},
			function(err, txHash) {
				if(err) {
					logError("Buy transaction wasn't sent: " + err.toString().split("\n")[0]);
					return;
				}
				logSuccess("Buy transaction sent: " + txHash);
			}
		);
	};

	/**
	 * Gets the presale status to be used in the web page to fill in:
	 * 	* Character Cards Sold Counter
	 * 	* Last Being Price
	 * 	* Next Being Price
	 * 	* Current Price
	 * 	* Current Price Increase Value (Next Being Price minus Current Price)
	 */
	this.presaleStatus = function() {

	};
}


// TODO: do we need this function?
function cards_available() {

}

// TODO: do we need this function?
function cards_sold() {

}
