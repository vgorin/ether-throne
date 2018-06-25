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
	// callback handlers, use bootstrap notify
	logger,
	// jQuery instance to use to load ABI for smart contracts
	$,
);

const displayStateCallback = (err, state) => {
	if(err || err > 0) {
		return;
	}
	$('span:contains(Character Cards Sold)').parent().prev().find("span").html(state.sold);
	$('span:contains(Last Being Price)').parent().next().find("span").html(state.lastPrice + " ETH");
	$('span:contains(Next Being Price)').parent().next().find("span").html(state.nextPrice + " ETH");
	$('span:contains(Curent Price)').parent().next().find("span").html(state.currentPrice + " ETH");
};

const transactionSentCallback = (err, result) => {
	if(err || err > 0) {
		return;
	}
	if(result.event === "transaction_sent") {
		logger.success("Transaction sent")
	}
};

// init Web3
presale.init(
	// deployed card instance address
	"0xb1b45d07a2eecdeb6a0c1dc394dd13e44ac48f43",
	// deployed presale instance address
	"0x4491aa0be95fe879b489e6665a0e8455d5d95ba1",
	(err, result) => {
		if(err || err > 0) {
			return;
		}
		presale.presaleState(displayStateCallback);
		presale.registerPurchaseCompleteEventListener((err, result) => {
			if(err || err > 0) {
				return;
			}
			logger.success("successfully bought " + result.quantity + " card" + (result.quantity > 1? "s": ""));
		});
		presale.registerPresaleStateChangedEventListener(displayStateCallback);
	}
);

// register button listeners, display presale status
$(document).ready(() => {
	$('span:contains("BUY BEING (1)")').bind("click", () => {
		presale.buyRandom(transactionSentCallback);
	});
	$('span:contains("BUY BEING (3)")').bind("click", () => {
		presale.buyRandom3(transactionSentCallback);
	});
	$('img[src="img/mcard-1.png"]').bind("click", () => {
		presale.buySpecific(0x803D, transactionSentCallback);
	});
	$('img[src="img/small_aldamean_card.png"]').bind("click", () => {
		presale.buySpecific(0x803E, transactionSentCallback);
	});
	$('img[src="img/small_chupatelo_card.png"]').bind("click", () => {
		presale.buySpecific(0x803F, transactionSentCallback);
	});
	$('img[src="img/small_droodoo_card.png"]').bind("click", () => {
		presale.buySpecific(0x8040, transactionSentCallback);
	});
	$('img[src="img/small_lizzaro_card.png"]').bind("click", () => {
		presale.buySpecific(0x8041, transactionSentCallback);
	});
	$('img[src="img/small_shinderra_card.png"]').bind("click", () => {
		presale.buySpecific(0x8042, transactionSentCallback);
	});
	$('img[src="img/small_spike_card.png"]').bind("click", () => {
		presale.buySpecific(0x8043, transactionSentCallback);
	});
	$('img[src="img/small_vipassana_card.png"]').bind("click", () => {
		presale.buySpecific(0x8044, transactionSentCallback);
	});
});
