// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0x49974c70ee946347d80b98d4bd3290cb00b4d80c",
	// deployed presale instance address
	"0xb661193e03ad49d08a2cc40f395db46000a768e9",
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
presale.init();

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
	$('img[src="img/small_shinderra_card.png"]').bind("click", function() {
		presale.buySpecific(1089);
	});
	$('img[src="img/small_spike_card.png"]').bind("click", function() {
		presale.buySpecific(1090);
	});
	$('img[src="img/small_vipassana_card.png"]').bind("click", function() {
		presale.buySpecific(1091);
	});
	presale.presaleStatus(
		function(err, result) {
			if(!err) {
				$('span:contains(Character Cards Sold)').parent().prev().select("span").html(result);
			}
		}
	);
});
