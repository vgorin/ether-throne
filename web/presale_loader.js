// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0x428bb118df746ddb871d3a0020cbc0d71cd61ba8",
	// deployed presale instance address
	"0x9269e5f237f18b2b24eda94e64a72ee390233f6d",
	// callback handlers, use bootstrap notify
	{
		errorHandler: function(msg) {
			$.notify(msg.replace(/\n/g,'<br/>'), {type: "danger"});
		},
		warningHandler: function(msg) {
			$.notify(msg.replace(/\n/g,'<br/>'), {type: "warning"});
		},
		successHandler: function(msg) {
			$.notify(msg.replace(/\n/g,'<br/>'), {type: "success"});
		},
	},
	// jQuery instance to use to load ABI for smart contracts
	$,
);

// configure bootstrap notify instance
$.notifyDefaults({
	placement: {
		from: "bottom",
		align: "right"
	},
	delay: 8192
});

// init Web3
presale.init(function() {
	presale.presaleStatus(
		function(err, result) {
			if(!err) {
				$('span:contains(Character Cards Sold)').parent().prev().find("span").html(result.sold);
				$('span:contains(Last Being Price)').parent().next().find("span").html(result.lastPrice + " ETH");
				$('span:contains(Next Being Price)').parent().next().find("span").html(result.currentPrice + " ETH");
				$('span:contains(Curent Price)').parent().next().find("span").html(result.currentPrice + " ETH");
			}
		}
	);
});

// register button listeners, display presale status
$(document).ready(function() {
	$('span:contains("BUY BEING (1)")').bind("click", function() {
		presale.buyRandom();
	});
	$('span:contains("BUY BEING (3)")').bind("click", function() {
		presale.buyRandom3();
	});
	$('img[src="img/mcard-1.png"]').bind("click", function() {
		presale.buySpecific(1085);
	});
	$('img[src="img/small_aldamean_card.png"]').bind("click", function() {
		presale.buySpecific(1086);
	});
	$('img[src="img/small_chupatelo_card.png"]').bind("click", function() {
		presale.buySpecific(1087);
	});
	$('img[src="img/small_droodoo_card.png"]').bind("click", function() {
		presale.buySpecific(1088);
	});
	$('img[src="img/small_lizzaro_card.png"]').bind("click", function() {
		presale.buySpecific(1089);
	});
	$('img[src="img/small_shinderra_card.png"]').bind("click", function() {
		presale.buySpecific(1090);
	});
	$('img[src="img/small_spike_card.png"]').bind("click", function() {
		presale.buySpecific(1091);
	});
	$('img[src="img/small_vipassana_card.png"]').bind("click", function() {
		presale.buySpecific(1092);
	});
});
