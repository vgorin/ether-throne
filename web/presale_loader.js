// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0xa96ea5c58b0a95a09e7805ce97ae02107b3454e4",
	// deployed presale instance address
	"0xad9ec2e6228c91c2591f6b45d931f5a06eafcf35",
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
		presale.buyUsual(0, 1085);
	});
	$('img[src="img/small_aldamean_card.png"]').bind("click", function() {
		presale.buyUsual(1, 1086);
	});
	$('img[src="img/small_chupatelo_card.png"]').bind("click", function() {
		presale.buyUsual(2, 1087);
	});
	$('img[src="img/small_droodoo_card.png"]').bind("click", function() {
		presale.buyUsual(3, 1088);
	});
	$('img[src="img/small_shinderra_card.png"]').bind("click", function() {
		presale.buyUsual(4, 1089);
	});
	$('img[src="img/small_spike_card.png"]').bind("click", function() {
		presale.buyUsual(5, 1090);
	});
	$('img[src="img/small_vipassana_card.png"]').bind("click", function() {
		presale.buyUsual(6, 1091);
	});
});
