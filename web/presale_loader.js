// configure bootstrap notify instance
$.notifyDefaults({
	placement: {
		from: "bottom",
		align: "right"
	},
	delay: 8192
});

// define a logger
const logger = {
	error: function(...msg) {
		$.notify(msg.join("").replace(/\n/g, '<br/>'), {
			type: "danger",
			delay: 8500,
		});
	},
	warning: function(...msg) {
		$.notify(msg.join("").replace(/\n/g, '<br/>'), {
			type: "warning",
			delay: 5500,
		});
	},
	success: function(...msg) {
		$.notify(msg.join("").replace(/\n/g, '<br/>'), {
			type: "success",
			delay: 1500,
		});
	},
};

// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0x6b1ba4617a22e468d684c8773540b4f786146a3e",
	// deployed presale instance address
	"0xb0b08df91eb6df58615359362fbed53e74a88527",
	// callback handlers, use bootstrap notify
	logger,
	// jQuery instance to use to load ABI for smart contracts
	$,
);

const displayStateCallback = (err, state) => {
	if(err) {
		return;
	}
	$('span:contains(Character Cards Sold)').parent().prev().find("span").html(state.sold);
	$('span:contains(Last Being Price)').parent().next().find("span").html(state.lastPrice + " ETH");
	$('span:contains(Next Being Price)').parent().next().find("span").html(state.nextPrice + " ETH");
	$('span:contains(Curent Price)').parent().next().find("span").html(state.currentPrice + " ETH");
};

const transactionSentCallback = (err, result) => {
	if(err) {
		return;
	}
	if(result.event === "transaction_sent") {
		logger.success("Transaction sent")
	}
};

// init Web3
presale.init((err, result) => {
	if(err) {
		return;
	}
	presale.presaleState(displayStateCallback);
	presale.registerPurchaseCompleteEventListener((err, result) => {
		if(err) {
			return;
		}
		logger.success("successfully bought " + result.quantity + " card" + (result.quantity > 1? "s": ""));
	});
	presale.registerPresaleStateChangedEventListener(displayStateCallback);
});

// register button listeners, display presale status
$(document).ready(() => {
	$('span:contains("BUY BEING (1)")').bind("click", () => {
		presale.buyRandom(transactionSentCallback);
	});
	$('span:contains("BUY BEING (3)")').bind("click", () => {
		presale.buyRandom3(transactionSentCallback);
	});
	$('img[src="img/mcard-1.png"]').bind("click", () => {
		presale.buySpecific(1085, transactionSentCallback);
	});
	$('img[src="img/small_aldamean_card.png"]').bind("click", () => {
		presale.buySpecific(1086, transactionSentCallback);
	});
	$('img[src="img/small_chupatelo_card.png"]').bind("click", () => {
		presale.buySpecific(1087, transactionSentCallback);
	});
	$('img[src="img/small_droodoo_card.png"]').bind("click", () => {
		presale.buySpecific(1088, transactionSentCallback);
	});
	$('img[src="img/small_lizzaro_card.png"]').bind("click", () => {
		presale.buySpecific(1089, transactionSentCallback);
	});
	$('img[src="img/small_shinderra_card.png"]').bind("click", () => {
		presale.buySpecific(1090, transactionSentCallback);
	});
	$('img[src="img/small_spike_card.png"]').bind("click", () => {
		presale.buySpecific(1091, transactionSentCallback);
	});
	$('img[src="img/small_vipassana_card.png"]').bind("click", () => {
		presale.buySpecific(1092, transactionSentCallback);
	});
});
