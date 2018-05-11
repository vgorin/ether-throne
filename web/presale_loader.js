// create an API client
const presale = new PresaleApi(
	// deployed card instance address
	"0x9f82b96e86b6d08da37a717d750763c6ef1312b3",
	// deployed presale instance address
	"0xfc30c43699f4046747c31ab7c1e76c76897b0e1d",
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
