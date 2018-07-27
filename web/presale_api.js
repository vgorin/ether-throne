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
 * Extend Array prototype by adding pack function.
 * Only array of strings is currently supported.
 * @param size used to pad each element in the array before joining
 * @return {String} packed string containing entire array
 */
Array.prototype.pack = function(size) {
	let copy = new Array(this.length);
	for(let i = 0; i < this.length; i++) {
		copy[i] = this[i].toString(16).pad(size);
	}
	return copy.join("");
};


/**
 * Presale API instance provides a convenient way ot access deployed
 * smart contract(s) functionality, including reading data, writing data
 * (transactions) and listening to specific event
 * @constructor
 * @param logger [optional] additional to `console` logger to use
 * @param jQuery_instance [optional] jQuery v3+ instance to use
 */
function PresaleApi(logger, jQuery_instance) {
	const ERR_NO_WEB3 = 0x1;
	const ERR_WEB3_LOCKED = 0x2;
	const ERR_WEB3_ETH_ERROR = 0x4;
	const ERR_AJAX_LOAD_ABI = 0x8;
	const ERR_CONTRACT_VERSION_MISMATCH = 0x10;
	const ERR_WRONG_ABI = 0x20;
	const ERR_WEB3_ERROR = 0x40;
	const ERR_NOT_INITIALIZED = 0x80;
	const ERR_NO_CALLBACK = 0x100;

	// ---------- START SECTION 1: Constants and Variables ----------
	// version constants define smart contracts compatible with this API
	const TOKEN_VERSION = 0xD;
	const PRESALE_VERSION = 0xC;

	// jQuery instance to use
	const jQuery3 = jQuery_instance || jQuery || $;

	// API state variables, depend on current connected network, default account, etc
	let myWeb3;
	let myAccount;
	let myNetwork;
	let tokenInstance;
	let presaleInstance;
	// ---------- END SECTION 1: Constants and Variables ----------


	// ---------- START SECTION 2: Auxiliary private functions ----------
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

	// call callback function safely in a try..catch block
	function tryCallback(callback, errCode, result) {
		try {
			callback(errCode, result);
		}
		catch(e) {
			logWarning("couldn't execute callback: ", e);
		}
	}

	// call callback function safely in a try..catch block
	// if callback is undefined or not a function - do nothing
	function tryCallbackIfProvided(callback, errCode, result) {
		if(callback && {}.toString.call(callback) === '[object Function]') {
			tryCallback(callback, errCode, result);
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

	// Called once tokenInstance or presaleInstance initialized,
	// used to execute the callback properly only after both instances are initialized
	// Callback is executed only on success. In case of error it has been already executed
	// in the place where an error occurred
	function instanceLoaded(callback) {
		if(tokenInstance && presaleInstance) {
			logSuccess("Application loaded successfully.\nNetwork " + networkName(myNetwork));
			tryCallbackIfProvided(callback, null, {
				event: "init_complete",
				network: networkName(myNetwork)
			});
		}
	}
	// ---------- END SECTION 2: Auxiliary private functions ----------


	// ---------- START SECTION 3: API Initialization ----------
	/**
	 * Initializes presale API.
	 * 	* Checks if Web3 is enabled (MetaMask installed) – synchronous
	 * 	* Checks if user account is accessible (MetaMask unlocked)
	 * 	* Checks user balance (if its possible to submit transaction)
	 * 	* Loads ERC721 token smart contract ABI
	 * 	* Connects to deployed ERC721 instance and checks its version
	 * 	* Loads Presale smart contract ABI
	 * 	* Connects to deployed Presale instance and checks its version
	 * After all checks are done, sets tokenInstance and presaleInstance.
	 * If something goes wrong with ERC721 instance initialization,
	 * tokenInstance remains null
	 * If something goes wrong with Presale smart contract initialization,
	 * presaleInstance remains null
	 * @param token an object, representing deployed token instance, contains address, ABI URL or ABI itself
	 * 	{address: "0xabc...", abi_url: "https://path.to/abi.json", abi: [...abi array...]}
	 * 	if a string is passed instead of object – it will be treated as an address, equal to {address: token}
	 * @param presale an object, representing deployed presale instance, contains address, ABI URL or ABI itself
	 * 	{address: "0xabc...", abi_url: "https://path.to/abi.json", abi: [...abi array...]}
	 * 	if a string is passed instead of object – it will be treated as an address, equal to {address: presale}
	 * @param callback a function to be executed once initialization is complete,
	 * callback signature: callback(error, result) – error is null on success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.init = function(token, presale, callback) {
		if(typeof window.web3 == 'undefined') {
			logError("Web3 is not enabled. Do you need to install MetaMask?");
			return ERR_NO_WEB3;
		}
		myWeb3 = new Web3(window.web3.currentProvider);
		myWeb3.eth.getAccounts(function(err, accounts) {
			if(err) {
				logError("getAccounts() error: ", err);
				tryCallbackIfProvided(callback, ERR_WEB3_ETH_ERROR, err);
				return;
			}
			myAccount = accounts[0];
			myNetwork = myWeb3.version.network;
			if(!myAccount) {
				const err = "Cannot access default account.\nIs MetaMask locked?";
				logError(err);
				tryCallbackIfProvided(callback, ERR_WEB3_LOCKED, err);
				return;
			}
			logInfo("Web3 integration loaded. Your account is ", myAccount, ", network id ", networkName(myNetwork));
			myWeb3.eth.getBalance(myAccount, function(err, balance) {
				if(err) {
					logError("getBalance() error: ", err);
					tryCallbackIfProvided(callback, ERR_WEB3_ETH_ERROR, err);
					return;
				}
				if(balance > 210000000000000) { // 0.21 finney
					logInfo("Your balance is ", myWeb3.fromWei(balance, 'ether'), " ETH");
				}
				else if(balance > 0) {
					logWarning("Your ETH balance is close to zero.\nYou won't be able to send most transactions.");
				}
				else {
					logError("Your ETH balance is zero.\nYou won't be able to send any transaction.");
				}

				// if token contains ABI – do not make AJAX call, just load the contract
				if(token.abi) {
					loadTokenContract(token.abi);
				}
				// if token doesn't contain ABI – load it through AJAX call and then load the contract
				else {
					jQuery3.ajax({
						global: false,
						url: token.abi_url || "abi/ERC721.json",
						dataType: "json",
						success: function(data, textStatus, jqXHR) {
							logInfo("ERC721 ABI loaded successfully");
							loadTokenContract(data.abi);
						},
						error: function(jqXHR, textStatus, errorThrown) {
							logError("Cannot load ERC721 ABI: ", errorThrown);
							tryCallbackIfProvided(callback, ERR_AJAX_LOAD_ABI, errorThrown);
						}
					});
				}

				// if presale contains ABI – do not make AJAX call, just load the contract
				if(presale.abi) {
					loadPresaleContract(presale.abi);
				}
				// if presale doesn't contain ABI – load it through AJAX call and then load the contract
				else {
					jQuery3.ajax({
						global: false,
						url: presale.abi_url || "abi/Presale.json",
						dataType: "json",
						success: function(data, textStatus, jqXHR) {
							logInfo("Presale ABI loaded successfully");
							loadPresaleContract(data.abi);
						},
						error: function(jqXHR, textStatus, errorThrown) {
							logError("Cannot load Presale ABI: ", errorThrown);
							tryCallbackIfProvided(callback, ERR_AJAX_LOAD_ABI, errorThrown);
						}
					});
				}

				// --- START: Internal Section to Load Contracts ---
				// helper function to load token contract by ABI
				function loadTokenContract(abi) {
					const contract = myWeb3.eth.contract(abi);
					const address = token.address || token;
					const instance = contract.at(address);
					if(!instance.TOKEN_VERSION) {
						const err = "Wrong ERC721 ABI format: TOKEN_VERSION is undefined";
						logError(err);
						tryCallbackIfProvided(callback, ERR_WRONG_ABI, err);
						return;
					}
					instance.TOKEN_VERSION(function(err, version) {
						if(err) {
							logError("Error accessing ERC721 instance: ", err, "\nCannot access TOKEN_VERSION.");
							tryCallbackIfProvided(callback, ERR_WEB3_ERROR, err);
							return;
						}
						if(TOKEN_VERSION != version) {
							const err = "Error accessing ERC721 instance: not a valid instance.\n" +
								"Check if the address specified points to an ERC721 instance with a valid TOKEN_VERSION.\n" +
								"Version required: " + TOKEN_VERSION + ". Version found: " + version;
							logError(err);
							tryCallbackIfProvided(callback, ERR_CONTRACT_VERSION_MISMATCH, err);
							return;
						}
						logInfo("Successfully connected to ERC721 instance at ", address);
						tokenInstance = instance;
						instanceLoaded(callback);
						tokenInstance.balanceOf(myAccount, function(err, result) {
							if(err) {
								logError("Unable to get ERC721 token balance for account ", myAccount, ": ", err);
								return;
							}
							if(result > 0) {
								logInfo("You own ", result, " ERC721 tokens");
							}
							else {
								logInfo("You don't own any ERC721 tokens");
							}
						});
					});
				}

				// helper function to load presale contract by ABI
				function loadPresaleContract(abi) {
					const contract = myWeb3.eth.contract(abi);
					const address = presale.address || presale;
					const instance = contract.at(address);
					if(!instance.PRESALE_VERSION) {
						const err = "Wrong Presale ABI format: PRESALE_VERSION is undefined";
						logError(err);
						tryCallbackIfProvided(callback, ERR_WRONG_ABI, err);
						return;
					}
					instance.PRESALE_VERSION(function(err, version) {
						if(err) {
							logError("Error accessing Presale instance: ", err, "\nCannot access PRESALE_VERSION.");
							tryCallbackIfProvided(callback, ERR_WEB3_ERROR, err);
							return;
						}
						if(PRESALE_VERSION != version) {
							const err = "Error accessing Presale instance: not a valid instance.\n" +
								"Check if the address specified points to a Presale instance with a valid PRESALE_VERSION.\n" +
								"Version required: " + PRESALE_VERSION + ". Version found: " + version;
							logError(err);
							tryCallbackIfProvided(callback, ERR_CONTRACT_VERSION_MISMATCH, err);
							return;
						}
						logInfo("Successfully connected to Presale instance at ", address);
						presaleInstance = instance;
						instanceLoaded(callback);
					});
				}
				// --- END: Internal Section to Load Contracts ---

			});
		});

		return 0;
	};

	// getters available right after successful initialization:
	// Web3 instance, returns null if not initialized (probably MetaMask is not installed)
	this.getWeb3 = function() {
		return myWeb3;
	};
	// current active account, returns null if not initialized or account is inaccessible (probably MetaMask is locked)
	this.getDefaultAccount = function() {
		return myAccount;
	};
	// currently connected network ID, returns null if not initialized
	this.getNetworkId = function() {
		return myNetwork;
	};
	// user-friendly name for network ID
	this.getNetworkName = function() {
		return networkName(myNetwork);
	};
	// checks if instance is successfully initialized
	this.initialized = function() {
		return tokenInstance && presaleInstance;
	};
	// ---------- END SECTION 3: API Initialization ----------


	// ---------- START SECTION 4: Presale API Transactions ----------
	/**
	 * Prepares a Web3 transaction to buy a specific card,
	 * bound to a particular card icon.
	 * Requires an API to be properly initialized:
	 * tokenInstance and presaleInstance initialized
	 * @param cardId card number to buy
	 * @param callback a function to call on error / success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.buySpecific = function(cardId, callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
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
		// no sync errors – return 0
		return 0;
	};

	/**
	 * Prepares a Web3 transaction to buy a single card,
	 * bound to a "BUY BEING (1)" and "BUY BEING" buttons.
	 * Requires an API to be properly initialized:
	 * tokenInstance and presaleInstance initialized
	 * @param callback a function to call on error / success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.buyRandom = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		presaleInstance.nextPrice(function(err, result) {
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
		// no sync errors – return 0
		return 0;
	};

	/**
	 * Prepares a Web3 transaction to buy 3 cards,
	 * bound to a "BUY BEING (3)" button
	 * Requires an API to be properly initialized:
	 * tokenInstance and presaleInstance initialized
	 * @param callback a function to call on error / success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.buyRandom3 = function(callback) {
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		presaleInstance.nextPrice(function(err, result) {
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
		// no sync errors – return 0
		return 0;
	};
	// ---------- END SECTION 4: Presale API Transactions ----------


	// ---------- START SECTION 5: Presale API Public Getters ----------
	/**
	 * Gets the presale state to be used in the web page to fill in:
	 * 	* Character Cards Sold Counter
	 * 	* Last Being Price
	 * 	* Next Being Price
	 * 	* Current Price
	 * 	* Current Price Increase Value (Next Being Price minus Current Price)
	 * @param callback a function to call on error / success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.presaleState = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			tryCallback(callback, "Presale API is not properly initialized", null);
			return ERR_NOT_INITIALIZED;
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
				const sold = result.dividedToIntegerBy(uint192).dividedToIntegerBy(0x10000);
				const left = result.dividedToIntegerBy(uint192).modulo(0x10000);
				const lastPrice = result.dividedToIntegerBy(uint128).modulo(uint64);
				const currentPrice = result.dividedToIntegerBy(uint64).modulo(uint64);
				const nextPrice = result.modulo(uint64);
				logInfo("sold: ", sold, " left: ", left, ", last price: ", lastPrice, ", current price: ", currentPrice, " next price: ", nextPrice);
				tryCallback(callback, null, {
					sold: sold.toNumber(),
					left: left.toNumber(),
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
		// no sync errors – return 0
		return 0;
	};

	/**
	 * Retrieves a bitmap of all available cards for sale
	 * @param callback a function to call on error / success
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.availableCardsBitmap = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
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
					bitmap += result[i].toString(2).pad(0x100).split("").reverse().join("");
				}
				bitmap = bitmap.substr(0, totalCards);
				logTrace(bitmap);
				tryCallback(callback, null, bitmap);
			});
		});
		// no sync errors – return 0
		return 0;
	};

	/**
	 * Retrieves list of tokens (full objects) owned by a particular address
	 * @param owner an address to query token collection for, current account by default
	 * @param callback a function to pass a result (if successful) or an error
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.getCollection = function(owner = myAccount, callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && tokenInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		tokenInstance.getCollection(owner, function(err, collection) {
			if(err) {
				logError("Cannot load list of the tokens: ", err);
				tryCallback(callback, err, null);
				return;
			}
			const tokens = {
				ids: [],
				size: collection.length
			};
			let fetched = 0;
			if(collection.length > 0) {
				logInfo("Tokens owned by ", owner, ": ", ...collection);
				for(let i = 0; i < collection.length; i++) {
					const tokenId = collection[i];
					tokenInstance.getPacked(tokenId, function(err, packed) {
						if(err) {
							logError("Cannot load card ", tokenId, ": ", err);
							tryCallback(callback, err, null);
							return;
						}
						tokens["ids"].push(tokenId);
						tokens[tokenId] = packed.pack(64);
						fetched++;
						if(fetched === collection.length) {
							tokens.ids.sort();
							tryCallback(callback, null, tokens);
						}
					});
				}
			}
			else {
				logInfo("Address ", owner, " doesn't own any tokens");
				tryCallback(callback, null, tokens);
			}
		});
		// no sync errors – return 0
		return 0;
	};

	/**
	 * Retrieves token creation time in seconds (unix timestamp)
	 * @param tokenId
	 * @param callback a function to pass a result (if successful) or an error
	 * @return {number} positive error code, if error occurred synchronously, zero otherwise
	 * if error occurred asynchronously - error code will be passed to callback
	 */
	this.getTokenCreationTime = function(tokenId, callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && tokenInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}

		tokenInstance.getCreationTime(tokenId, function(err, result) {
			if(err) {
				logError("Cannot get token creation block: ", err);
				tryCallback(callback, err, null);
				return;
			}
			myWeb3.eth.getBlock(result, function(err, result) {
				if(err) {
					logError("Cannot get token creation block: ", err);
					tryCallback(callback, err, null);
					return;
				}
				logInfo("Token ", tokenId, " creation time is ", result.timestamp);
				tryCallback(callback, null, result.timestamp);
			});
		});

		// no sync errors – return 0
		return 0;
	};
	// ---------- END SECTION 5: Presale API Public Getters ----------


	// ---------- START SECTION 6: Public Event Listeners ----------
	// register Mint event listener
	this.registerMintEventListener = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && tokenInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		const mintEvent = tokenInstance.Minted({_to: myAccount});
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
			tryCallback(callback, null, {
				event: "minted",
				by: by,
				to: to,
				tokenId: tokenId,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered Minted(uint16, address, address) event listener");
		// no sync errors – return 0
		return 0;
	};

	// register ERC20/ERC721 Transfer event listener
	this.registerTransferEventListener = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && tokenInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		const transferEvent = tokenInstance.Transfer();
		transferEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving ERC20/ERC721 Transfer event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args._from && receipt.args._to && receipt.args._tokenId && receipt.args._value)) {
				logError("ERC20/ERC721 Transfer event received in wrong format: wrong arguments");
				return;
			}
			const from = receipt.args._from;
			const to = receipt.args._to;
			const tokenId = receipt.args._tokenId.toString(10);
			const value = receipt.args._value.toString(10);
			logInfo("ERC20/ERC721 Transfer(", from, ", ", to, ", ", value, ")");
			tryCallback(callback, null, {
				event: "transfer",
				from: from,
				to: to,
				tokenId: tokenId,
				value: value,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered ERC20/ERC721 Transfer(address, address, uint256, uint256) event listener");
		// no sync errors – return 0
		return 0;
	};

	// register PurchaseComplete event listener
	this.registerPurchaseCompleteEventListener = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
		}
		const purchaseCompleteEvent = presaleInstance.PurchaseComplete();
		purchaseCompleteEvent.watch(function(err, receipt) {
			if(err) {
				logError("Error receiving PurchaseComplete event: " + err);
				return;
			}
			if(!(receipt && receipt.args && receipt.args._from && receipt.args._to && receipt.args.quantity && receipt.args.totalPrice)) {
				logError("PurchaseComplete event received in wrong format: wrong arguments - " + receipt);
				return;
			}
			const from = receipt.args._from;
			const to = receipt.args._to;
			const q = receipt.args.quantity;
			const price = receipt.args.totalPrice;
			logInfo("PurchaseComplete(", from, ", ", to, ", ", q, ", ", price, ")");
			tryCallback(callback, null, {
				event: "purchase_complete",
				quantity: q,
				totalPrice: price,
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered PurchaseComplete(address, address, uint16, uint64) event listener");
		// no sync errors – return 0
		return 0;
	};

	// register PresaleStateChanged event listener
	this.registerPresaleStateChangedEventListener = function(callback) {
		if(!callback || {}.toString.call(callback) !== '[object Function]') {
			logError("callback is undefined or is not a function");
			return ERR_NO_CALLBACK;
		}
		if(!(myWeb3 && myAccount && presaleInstance)) {
			logError("Presale API is not properly initialized. Reload the page.");
			return ERR_NOT_INITIALIZED;
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
			const sold = receipt.args.sold;
			const left = receipt.args.left;
			const lastPrice = receipt.args.lastPrice;
			const currentPrice = receipt.args.currentPrice;
			const nextPrice = receipt.args.nextPrice;
			logInfo("PresaleStateChanged(", sold, ", ", left, ", ", lastPrice, ", ", currentPrice, ", ", nextPrice, ")");
			tryCallback(callback, null, {
				event: "presale_state_changed",
				sold: sold.toNumber(),
				left: left.toNumber(),
				lastPrice: myWeb3.fromWei(lastPrice, "ether").toNumber(),
				currentPrice: myWeb3.fromWei(currentPrice, "ether").toNumber(),
				nextPrice: myWeb3.fromWei(nextPrice, "ether").toNumber(),
				txHash: receipt.transactionHash
			});
		});
		logInfo("Successfully registered PresaleStateChanged(uint16, uint16, uint64, uint64, uint64) event listener");
		// no sync errors – return 0
		return 0;
	};
	// ---------- END SECTION 6: Public Event Listeners ----------
}
