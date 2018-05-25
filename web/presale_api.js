/**
 * Extend String prototype by adding pad function
 * @param size new String length, will be padded with zeros
 * @return {String} zero padded string
 */
String.prototype.pad = function(size) {
	let s = this;
	while(s.length < (size || 2)) {
		s = "0" + s;
	}
	return s;
};

/**
 *
 * @param cardAddr
 * @param presaleAddr
 * @param logger
 * @param jQuery_instance
 * @constructor
 */
function PresaleApi(cardAddr, presaleAddr, logger, jQuery_instance) {
	const CHAR_CARD_VERSION = 0xC;
	const PRESALE_VERSION = 0xB;
	const jQuery3 = jQuery_instance? jQuery_instance: jQuery;
	let myWeb3;
	let myAccount;
	let myNetwork;
	let cardInstance;
	let presaleInstance;

	// logs an error into console, triggers logger's error callback if provided
	function logError(...msg) {
		console.error(msg.join(""));
		if(logger && logger.error) {
			try {
				logger.error(...msg);
			}
			catch(e) {
				console.error("external logger call [error] failed: " + e);
			}
		}
	}

	// logs a warning into console, triggers logger's warning callback if provided
	function logWarning(...msg) {
		console.warn(msg.join(""));
		if(logger && logger.warning) {
			try {
				logger.warning(...msg);
			}
			catch(e) {
				console.error("external logger call [warning] failed: " + e);
			}
		}
	}

	// logs a message into console, triggers logger's info callback if provided
	function logInfo(...msg) {
		console.log(msg.join(""));
		if(logger && logger.info) {
			try {
				logger.info(...msg);
			}
			catch(e) {
				console.error("external logger call [info] failed: " + e);
			}
		}
	}

	// logs a message into console, triggers logger's trace callback if provided
	function logTrace(...msg) {
		console.log(msg.join(""));
		if(logger && logger.trace) {
			try {
				logger.trace(...msg);
			}
			catch(e) {
				console.error("external logger call [info] failed: " + e);
			}
		}
	}

	// logs a message into console, triggers logger's success callback if provided
	function logSuccess(...msg) {
		console.log(msg.join(""));
		if(logger && logger.success) {
			try {
				logger.success(...msg);
			}
			catch(e) {
				console.error("external logger call [success] failed: " + e);
			}
		}
	}

	// register Mint event listener
	this.registerMintEventListener = function(callback) {
		if(!(myWeb3 && myAccount && cardInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x2;
		}
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
			const tokenId = receipt.args._tokenId.toString(10);
			logInfo("Minted(", by, ", ", to, ", ", tokenId, ")");
			tryCallbackIfProvided(callback, null, {
				event: "minted",
				by: by,
				to: to,
				tokenId: tokenId,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered Minted(uint16, address, address) event listener");
	};

	// register ERC721 TokenTransfer event listener
	this.registerTokenTransferEventListener = function(callback) {
		if(!(myWeb3 && myAccount && cardInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x2;
		}
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
			const tokenId = receipt.args._tokenId.toString(10);
			logInfo("ERC721 CardTransfer(", from, ", ", to, ", ", tokenId, ")");
			tryCallbackIfProvided(callback, null, {
				event: "token_transfer",
				from: from,
				to: to,
				tokenId: tokenId,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered ERC721 CardTransfer(uint16, address, address) event listener");
	};

	// register ERC20 Transfer event listener
	this.registerTransferEventListener = function(callback) {
		if(!(myWeb3 && myAccount && cardInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x2;
		}
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
			logInfo("ERC20 Transfer(", from, ", ", to, ", ", value, ")");
			tryCallbackIfProvided(callback, null, {
				event: "transfer",
				from: from,
				to: to,
				value: value,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered ERC20 Transfer(address, address, uint16) event listener");
	};

/*
	// register BattleComplete event listener
	function registerBattleCompleteEventListener(battleProviderInstance) {
		const battleCompleteEvent = battleProviderInstance.BattleComplete();
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
				logError("BattleComplete event received in wrong format: wrong arguments - " + receipt);
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
*/

	// register PurchaseComplete event listener
	this.registerPurchaseCompleteEventListener = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		const purchaseCompleteEvent = presaleInstance.PurchaseComplete();
		purchaseCompleteEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving PurchaseComplete event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args.from && receipt.args.to && receipt.args.quantity && receipt.args.totalPrice)) {
				logError("PurchaseComplete event received in wrong format: wrong arguments - " + receipt);
				return;
			}
			const from = receipt.args.from;
			const to = receipt.args.to;
			const q = receipt.args.quantity;
			const price = receipt.args.totalPrice;
			logInfo("PurchaseComplete(", from, ", ", to, ", ", q, ", ", price, ")");
			tryCallbackIfProvided(callback, null, {
				event: "purchase_complete",
				quantity: q,
				totalPrice: price,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered PurchaseComplete(address, address, uint16, uint64) event listener");
	};

	// register PresaleStateChanged event listener
	this.registerPresaleStateChangedEventListener = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		const presaleStateChangedEvent = presaleInstance.PresaleStateChanged();
		presaleStateChangedEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving PresaleStateChanged event: ", err);
				return;
			}
			if(!(receipt && receipt.args
					&& receipt.args.sold
					&& receipt.args.left
					&& receipt.args.lastPrice
					&& receipt.args.currentPrice
					&& receipt.args.nextPrice)) {
				logError("PresaleStateChanged event received in wrong format: wrong arguments - ", receipt);
				return;
			}
			const cardsSold = receipt.args.sold;
			const cardsLeft = receipt.args.left;
			const lastPrice = receipt.args.lastPrice;
			const currentPrice = receipt.args.currentPrice;
			const nextPrice = receipt.args.nextPrice;
			logInfo("PresaleStateChanged(", cardsSold, ", ", cardsLeft, ", ", lastPrice, ", ", currentPrice, ",", nextPrice, ")");
			tryCallbackIfProvided(callback, null, {
				event: "presale_state_complete",
				sold: cardsSold.toNumber(),
				left: cardsLeft.toNumber(),
				lastPrice: myWeb3.fromWei(lastPrice, "ether").toNumber(),
				currentPrice: myWeb3.fromWei(currentPrice, "ether").toNumber(),
				nextPrice: myWeb3.fromWei(nextPrice, "ether").toNumber(),
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered PresaleStateChanged(uint16, uint16, uint64, uint64, uint64) event listener");
	};

	// Called once cardInstance or presaleInstance initialized
	function instanceLoaded(callback) {
		if(cardInstance && presaleInstance) {
			logSuccess("Application loaded successfully.\nNetwork " + networkName(myNetwork));
			if(callback) {
				tryCallback(callback, null, {
					event: "init_complete",
					network: networkName(myNetwork)
				});
			}
		}
	}

	// Translates network ID into human-readable network name
	function networkName(network) {
		switch(network) {
			case "0": return "0: Olympic";
			case "1": return "1: Frontier";
			case "2": return "2: Morden";
			case "3": return "3: Ropsten";
			case "4": return "4: Rinkeby";
			case "42": return "42: Kovan";
			case "77": return "77: Sokol";
			case "99": return "99: POA";
			case "7762959": return "7762959: Musicoin";
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
	this.init = function(callback) {
		if(typeof window.web3 == 'undefined') {
			logError("Web3 is not enabled. Do you need to install MetaMask?");
			return 0x1;
		}
		myWeb3 = new Web3(window.web3.currentProvider);
		myWeb3.eth.getAccounts(function(err, accounts) {
			if(err) {
				logError("getAccounts() error: ", err);
				tryCallbackIfProvided(callback, err, null);
				return;
			}
			myAccount = accounts[0];
			myNetwork = myWeb3.version.network;
			if(!myAccount) {
				const err = "Cannot access default account.\nIs MetaMask locked?";
				logError(err);
				tryCallbackIfProvided(callback, err, null);
				return;
			}
			logInfo("Web3 integration loaded. Your account is ", myAccount, ", network id ", networkName(myNetwork));
			myWeb3.eth.getBalance(myAccount, function(err, balance) {
				if(err) {
					logError("getBalance() error: ", err);
					tryCallbackIfProvided(callback, err, null);
					return;
				}
				if(balance > 0) {
					logInfo("Your balance is ", myWeb3.fromWei(balance, 'ether'));
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
									logError("Error accessing Character Card (ERC721) Instance: ", err, "\nCannot access CHAR_CARD_VERSION.");
									tryCallbackIfProvided(callback, err, null);
									return;
								}
								if(CHAR_CARD_VERSION != version) {
									const err = "Error accessing Character Card (ERC721) Instance: not a valid instance.\n" +
										"Check if the address specified points to an ERC721 instance with a valid CHAR_CARD_VERSION.\n" +
										"Version required: " + CHAR_CARD_VERSION + ". Version found: " + version;
									logError(err);
									tryCallbackIfProvided(callback, err, null);
									return;
								}
								logInfo("Successfully connected to Character Card (ERC721) Instance at ", cardAddr);
								cardInstance = instance;
								instanceLoaded(callback);
								cardInstance.getCollection(myAccount, function(err, result) {
									if(err) {
										logError("Unable to get cards list for account ", myAccount, ": ", err);
										return;
									}
									if(result.length > 0) {
										logInfo("List of the cards you own: ", result.join(", "));
									}
									else {
										logInfo("You don't own any cards");
									}
								});
							});
						}
						catch(err) {
							logError("Cannot access Character Card (ERC721) Instance: ", err);
							tryCallbackIfProvided(callback, err, null);
						}
					},
					error: function(jqXHR, textStatus, errorThrown) {
						logError("Cannot load Character Card ABI: ", errorThrown);
						tryCallbackIfProvided(callback, errorThrown, null);
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
									logError("Error accessing Presale Instance: ", err, "\nCannot access PRESALE_VERSION.");
									tryCallbackIfProvided(callback, err, null);
									return;
								}
								if(PRESALE_VERSION != version) {
									const err = "Error accessing Presale Instance: not a valid instance.\n" +
										"Check if the address specified points to a Presale instance with a valid PRESALE_VERSION.\n" +
										"Version required: " + PRESALE_VERSION + ". Version found: " + version;
									logError(err);
									tryCallbackIfProvided(callback, err, null);
									return;
								}
								logInfo("Successfully connected to Presale Instance at ", presaleAddr);
								presaleInstance = instance;
								instanceLoaded(callback);
							});
						}
						catch(err) {
							logError("Cannot access Presale Instance: ", err);
						}
					},
					error: function(jqXHR, textStatus, errorThrown) {
						logError("Cannot load Presale ABI: ", errorThrown);
						tryCallbackIfProvided(callback, errorThrown, null);
					}
				});
			});
		});

		return 0;
	};

	/**
	 * Prepares a Web3 transaction to buy a specific card,
	 * bound to a particular card icon.
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 * @param cardId card number to buy
	 * @param callback a function to call on error / success
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.buySpecific = function(cardId, callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		presaleInstance.specificPrice(cardId, function(err, result) {
			if(err) {
				logError("Unable to get card price for ", cardId, ": ", err);
				tryCallbackIfProvided(callback, err, null);
				return;
			}
			presaleInstance.buySpecific.sendTransaction(cardId, {value: result}, function(err, txHash) {
				if(err) {
					logError("buySpecific(", cardId, ") transaction wasn't sent: ", err.toString().split("\n")[0]);
					tryCallbackIfProvided(callback, err, null);
					return;
				}
				logInfo("buySpecific(", cardId, ") transaction sent: ", txHash);
				tryCallbackIfProvided(callback, null, {
					event: "transaction_sent",
					name: "buySpecific",
					txHash: txHash
				});

				// TODO: wait for this particular event to return and call callback
			});
		});
	};

	/**
	 * Prepares a Web3 transaction to buy a single card,
	 * bound to a "BUY BEING (1)" and "BUY BEING" buttons.
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 * @param callback a function to call on error / success
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.buyRandom = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		presaleInstance.currentPrice(function(err, result) {
			if(err) {
				logError("Unable to get random card price: ", err);
				tryCallbackIfProvided(callback, err, null);
				return;
			}
			presaleInstance.buyOneRandom.sendTransaction({value: result}, function(err, txHash) {
				if(err) {
					logError("buyRandom(1) transaction wasn't sent: ", err.toString().split("\n")[0]);
					tryCallbackIfProvided(callback, err, null);
					return;
				}
				logInfo("buyRandom(1) transaction sent: ", txHash);
				tryCallbackIfProvided(callback, null, {
					event: "transaction_sent",
					name: "buyRandom(1)",
					txHash: txHash
				});

				// TODO: wait for this particular event to return and call callback
			});
		});
	};

	/**
	 * Prepares a Web3 transaction to buy 3 cards,
	 * bound to a "BUY BEING (3)" button
	 * Requires an API to be properly initialized:
	 * cardInstance and presaleInstance initialized
	 * @param callback a function to call on error / success
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.buyRandom3 = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		presaleInstance.currentPrice(function(err, result) {
			if(err) {
				logError("Unable to get random card price: ", err);
				tryCallbackIfProvided(callback, err, null);
				return;
			}
			presaleInstance.buyThreeRandom.sendTransaction({value: result.times(2)}, function(err, txHash) {
					if(err) {
						logError("buyRandom(3) transaction wasn't sent: ", err.toString().split("\n")[0]);
						tryCallbackIfProvided(callback, err, null);
						return;
					}
					logInfo("buyRandom(3) transaction sent: ", txHash);
					tryCallbackIfProvided(callback, null, {
						event: "transaction_sent",
						name: "buyRandom(3)",
						txHash: txHash
					});
					// TODO: wait for this particular event to return and call callback
				}
			);
		});
	};

	/**
	 * Gets the presale state to be used in the web page to fill in:
	 * 	* Character Cards Sold Counter
	 * 	* Last Being Price
	 * 	* Next Being Price
	 * 	* Current Price
	 * 	* Current Price Increase Value (Next Being Price minus Current Price)
	 * @param callback a function to call on error / success
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.presaleState = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return 0x10;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			tryCallback(callback, "Presale API is not properly initialized", null);
			return 0x3;
		}
		presaleInstance.getPacked(function(err, result) {
			if(err) {
				logError("Error getting presale state: " + err);
				tryCallback(callback, err, null);
				return;
			}
			try {
				const uint64 = myWeb3.toBigNumber("0x10000000000000000");
				const uint128 = uint64.times(uint64);
				const uint192 = uint128.times(uint64);
				const soldCards = result.dividedToIntegerBy(uint192).dividedToIntegerBy(65536);
				const leftCards = result.dividedToIntegerBy(uint192).modulo(65536);
				const lastPrice = result.dividedToIntegerBy(uint128).modulo(uint64);
				const currentPrice = result.dividedToIntegerBy(uint64).modulo(uint64);
				const nextPrice = result.modulo(uint64);
				logInfo("sold: ", soldCards, " left: ", leftCards, ", last price: ", lastPrice, ", current price: ", currentPrice, " next price: ", nextPrice);
				tryCallback(callback, null, {
					sold: soldCards.toNumber(),
					left: leftCards.toNumber(),
					lastPrice: myWeb3.fromWei(lastPrice, "ether").toNumber(),
					currentPrice: myWeb3.fromWei(currentPrice, "ether").toNumber(),
					nextPrice: myWeb3.fromWei(nextPrice, "ether").toNumber(),
				});
			}
			catch(e) {
				logError("Error parsing presale state: ", e);
				tryCallback(callback, e, null);
			}
		});
	};

	/**
	 * Retrieves a bitmap of all available cards for sale
	 * @param callback a function to call on error / success
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.availableCardsBitmap = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return 0x10;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x3;
		}
		presaleInstance.TOTAL_CARDS(function(err, result) {
			if(err) {
				logError("Unable to get TOTAL_CARDS for sale: ", err);
				tryCallback(callback, err, null);
				return;
			}
			const totalCards = result.toNumber();
			logInfo("TOTAL_CARDS for sale: ", totalCards);
			presaleInstance.getBitmap(function(err, result) {
				if(err) {
					logError("Error getting presale bitmap: ", err);
					tryCallback(callback, err, null);
					return;
				}
				let bitmap = "";
				for(let i = 0; i < result.length; i++) {
					bitmap += result[i].toString(2).pad(256).split("").reverse().join("");
				}
				bitmap = bitmap.substr(0, totalCards);
				logTrace(bitmap);
				tryCallback(callback, null, bitmap);
			});
		});
	};

	/**
	 * Retrieves list of card IDs owned by a particular address
	 * @param owner address to query cards collection (IDs only) for
	 * @param callback a function to pass a result (if successful) or an error
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.cardIdsByOwner = function(owner, callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return 0x10;
		}
		if(!(myWeb3 && myAccount && cardInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x2;
		}
		cardInstance.getCollection(owner, function(err, collection) {
			if(err) {
				logError("Cannot load list of the cards: ", err);
				tryCallback(callback, err, null);
				return;
			}
			if(collection.length > 0) {
				logInfo("Cards owned by ", owner, ": ", ...collection);
			}
			else {
				logInfo("Address ", owner, " doesn't own any cards");
			}
			tryCallback(callback, null, collection);
		});
	};

	/**
	 * Retrieves list of cards (full objects) owned by a particular address
	 * @param owner address to query cards collection for
	 * @param callback a function to pass a result (if successful) or an error
	 * @return {number} error code, if it occurred synchronously, undefined otherwise
	 */
	this.cardsByOwner = function(owner, callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return 0x10;
		}
		if(!(myWeb3 && myAccount && cardInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return 0x2;
		}
		cardInstance.getCollection(owner, function(err, collection) {
			if(err) {
				logError("Cannot load list of the cards: ", err);
				tryCallback(callback, err, null);
				return;
			}
			const cards = {
				ids: [],
				size: collection.length
			};
			let fetched = 0;
			if(collection.length > 0) {
				logInfo("Cards owned by ", owner, ": ", ...collection);
				for(let i = 0; i < collection.length; i++) {
					const cardId = collection[i];
					cardInstance.getPacked(cardId, function(err, packed) {
						if(err) {
							logError("Cannot load card ", cardId, ": ", err);
							tryCallback(callback, err, null);
							return;
						}
						cards["ids"].push(cardId);
						cards[cardId] = cardToString(packed);
						fetched++;
						if(fetched === collection.length) {
							cards.ids.sort();
							tryCallback(callback, null, cards);
						}
					});
				}
			}
			else {
				logInfo("Address ", owner, " doesn't own any cards");
				tryCallback(callback, null, cards);
			}
		});
	};

	function cardToString(packed512) {
		let left = packed512[0].toString(16);
		const leftZeros = 64 - left.length;
		let right = packed512[1].toString(16);
		const rightZeros = 64 - right.length;
		for(let i = 0; i < leftZeros; i++) {
			left = "0" + left;
		}
		for(let i = 0; i < rightZeros; i++) {
			right = "0" + right;
		}
		return left + right;
	}

	// call callback function safely in a try..catch block
	function tryCallback(callback, err, result) {
		try {
			callback(err, result);
		}
		catch(e) {
			logWarning("couldn't execute callback: ", e);
		}
	}

	// call callback function safely in a try..catch block
	// if callback is undefined or not a function - do nothing
	function tryCallbackIfProvided(callback, err, result) {
		if(callback && {}.toString.call(callback) === '[object Function]') {
			tryCallback(callback, err, result);
		}
	}
}


