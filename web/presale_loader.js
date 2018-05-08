// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0xf05e09f6554b5d1b1be4a52749ef4d40a1255b02",
	// deployed presale instance address
	"0xd1ac3c51171e357b424873cddb539e8154884720",
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
		presale.buy();
	});
	$('span:contains("BUY BEING (3)")').bind("click", function() {
		presale.buy3();
	});
});
