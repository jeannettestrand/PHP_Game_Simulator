// ---------------------------
//
//PIGGIE CLIENT
//
// Usage:
//	nodejs piggie.js --user=<user_id> --gs=<game_server_url> --sn=<social_network_ip> --time=<time_in_seconds> [--verbose]
//
//	--user: the player's user id in the game; an integer from 1 to 300,000
//
//	--time: roughly the number of seconds the simulation should last (to represent the
//               length of time the user plays the game)
//
//	--sn: the ip of the social network.  This will be used to get the list of the user's friends and their app friends.
//
//	--gs: the url of the game server (where /init.php, /start_game.php etc. are called).
//             For example, if you're running locally and you're implementing the starter, it would be:
//		
//	--gs=localhost/piggie_starter
//
//	--verbose: if present, will output messages for all the game play.  Useful for debugging and tracking an entire 
//                  play cycle.  If it is not present, the only output will be the JSON stats results, appropriate for
//                  sim_worker instances (but also human-readable if launched standalone).
//
// ------------------------------

// This line is needed to get a XMLHttpRequest object; this thing is
// normally provided directly by the browser, so we need to get one here from
// the nodejs library.


var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var xmlhttp = new XMLHttpRequest();

// How often should the master block checker poll?
var master_poll = 30;

// A callback to handle a completed server call.
var xmlhttp_callback;
xmlhttp.onreadystatechange = function() {
	if (this.readyState === 4) {
		requestDone = true;
		xmlhttp_callback();
	}
}


// Internal user data.  Normally this would be used to create visual items for the user to
// enjoy. :)
var user;
var collections;
var config;
var appFriends;
var nonAppFriends;

// Some global data that ends up being passed to the server.
var game_id;


// The "piggie" object organizes the main functions a player needs to do: init
// (login), startGame, play, purchase.	
piggie = {

	sn : function() {
		if ( verbose ) console.log("Starting Social Network...");
		var startTime = Date.now();
		xmlhttp_callback = function() {
			if (verbose) console.log("Social Network call complete");
			try {
				var resp = JSON.parse(xmlhttp.responseText);
					if ( resp.status == "error" ) {
					if ( verbose ) console.log("sn server error: " + resp.message);
					errors.sn += 1;
					blocks.push("sn");
					blockDone = true;
				} else {
					// Parse social network response for the app friends
					appFriends = JSON.parse(JSON.stringify(resp.app_friends));
					//if (verbose) console.log("APP FRIENDS  " + appFriends);	
					
					times.sn.push(Date.now() - startTime);
					if (verbose) console.log("sn time  " + times.sn);

					blocks.push("init");
					if (verbose) console.log("Social Network Complete");
					blockDone = true;
				} 
			} catch (err) {
				if (verbose) console.log("sn error: " + err + "\n\n" + xmlhttp.responseText );
				errors.sn += 1;
				blocks.push("sn");
				blockDone = true;
			}
		};
		
		// MAKE the social network call for friends
		//
		xmlhttp.open("GET", snURL + "/sn/friends.php?id="+ userId, true);
		try {
			xmlhttp.send();
		} catch (err) {
			if (verbose) console.log("Social Network fail: " + err);
			errors.sn += 1;
			blocks.push("sn");
			blockDone = true;
		}
	},



	// The init callback calls the game server to reques login.
	// Sends the user ID to the game server.
	// Receives user info, user collection items, game configuration details.
	// If all is successful, adds the next function call to the game data structure.
	init: function() {
		if (verbose) console.log("Starting init...");
		var startTime = Date.now();
		xmlhttp_callback = function() {
			if (verbose) console.log("login.php call complete.");

			// Process the results.	We just parse the response and save the
			// data pieces in global variables.
			try {
				var resp = JSON.parse(xmlhttp.responseText);
				if (resp.status == "error") {
					if (verbose) console.log("INIT server error: " + resp.message);
					errors.init += 1;
					blocks.push("init");
					blockDone = true;
				} else {
					user = JSON.parse(JSON.stringify(resp.user));
					collections = JSON.parse(JSON.stringify(resp.collections));
					config = JSON.parse(JSON.stringify(resp.config));
					times.init.push(Date.now() - startTime);
					blocks.push("start_game");
					if (verbose) console.log("Login complete");
					blockDone = true;
				}
			} catch (err) {
				if (verbose) console.log("LOGIN response error: " + err + "\n\n" + xmlhttp.responseText);
				errors.init += 1;
				blocks.push("init");
				blockDone = true;
			}
		};
		
		// Do the login call.
		xmlhttp.open("POST", gsURL + "login.php?id=" + userId + "&appFriends=" + JSON.stringify(appFriends), true);
		try {
			xmlhttp.send();
		} catch (err) {
			if (verbose) console.log("INIT FAIL: " + err);
			errors.init += 1;
			blocks.push("init");
			blockDone = true;
		}
	},
	
	// This simulates a "session" consisting of a single game play 
	// It takes as input the player's user id, and the id of the game the
	// player selects.
	//
	// It simulates a play by first telling the server the game the player
	// selected (/start_game.php), and then randomly does 1-100 "play" actions
	// on the game.
	startGame: function() { 
		var startTime = Date.now();
		game_id = Math.floor(Math.random() * 20) + 1;
		if (verbose) console.log("Starting new game #" + game_id + " ...");
		xmlhttp_callback = function() {
			try {
				var resp = JSON.parse(xmlhttp.responseText);
				if (resp.status == "error") {
					if (verbose) console.log("START GAME server error: " + resp.message);
					errors.startGame += 1;
					blocks.push("start_game");
					blockDone = true;
				} else {
					times.startGame.push(Date.now() - startTime);
					var numPlays = Math.floor(Math.random() * 100) + 1;
					if (verbose) console.log("Playing game " + game_id + " " + numPlays + " times ...");
					for (var i = 0; i < numPlays; i++) blocks.push("play");
					blockDone = true;
				}
			} catch (err) {
				if (verbose) console.log("START GAME response error: " + err + "\n\n" + xmlhttp.responseText);
				errors.startGame += 1;
				blocks.push("start_game");
				blockDone = true;
			}
		};
		
		// Do the start_game server call.
		xmlhttp.open("POST", gsURL + "start_game.php?id=" + user.id + "&gid=" + game_id, true);
		try {
			xmlhttp.send();
		} catch (err) {
			if (verbose) console.log("START GAME FAIL: " + err);
			errors.startGame += 1;
			blocks.push("start_game");
			blockDone = true;
		}
	},

	// Simulates a single play action (e.g. the pull of a slot machine).
	play: function() { 
		var startTime = Date.now();
		xmlhttp_callback = function() {

			try {
				var resp = JSON.parse(xmlhttp.responseText);
				if (resp.status == "error") {
					if (verbose) console.log("PLAY server error: " + resp.message);
					errors.play += 1;
					blocks.push("play");
					blockDone = true;
				} else {
					times.play.push(Date.now() - startTime);
					if (blocks.length == 0) {
						if (Math.random() < 0.5) blocks.push("start_game");
						else blocks.push("purchase");
						if (verbose) console.log("Playing game " + game_id + " complete.");
					}
					blockDone = true;
				}
			} catch (err) {
				if (verbose) console.log("PLAY response error: " + err + "\n\n" + xmlhttp.responseText);
				errors.play += 1;
				blocks.push("play");
				blockDone = true;
			}
		};
		
		// Do the play server call.
		xmlhttp.open("POST", gsURL + "play.php?id=" + user.id + "&gid=" + game_id + "&bet=1", true);
		try {
			xmlhttp.send();
		} catch (err) {
			if (verbose) console.log("PLAY FAIL: " + err);
			errors.play += 1;
			if (blocks.length == 0) {
					if (Math.random() < 0.5) blocks.push("start_game");
					else blocks.push("purchase");
					if (verbose) console.log("Playing game " + game_id + " complete.");
			}
			blockDone = true;
		}
	},
	
	// This function simulates a user's purchase of a collection item.	It's
	// just basically a single call the to /purchase.php endpoint, updating
	// the user's internal data structure as appropriate.
	purchase: function() { 
		var startTime = Date.now();
		var item_id = Math.floor(Math.random() * 1000) + 1;
		xmlhttp_callback = function() {
			try {
				var resp = JSON.parse(xmlhttp.responseText);
				if (resp.status == "error") {
					if (verbose) console.log("PURCHASE server error: " + resp.message);
					errors.purchase += 1;
					blocks.push("purchase");
					blockDone = true;
				} else {
					times.purchase.push(Date.now() - startTime);
					blocks.push("start_game");
					blockDone = true;
				}
			} catch (err) {
				if (verbose) console.log("PURCHASE response error: " + err + "\n\n" + xmlhttp.responseText);
				errors.purchase += 1;
				blocks.push("purchase");
				blockDone = true;
			}
		};
		
		// Do the purchase server call.
		xmlhttp.open("POST", gsURL + "/purchase.php?id=" + user.id + "&iid=" + item_id);
		try {
			xmlhttp.send();
		} catch (err) {
			if (verbose) console.log("ITEM PURCHASE FAIL: " + err);
			errors.purchase += 1;
			blockDone = true;
		}
	},

	
	calculateAverages: function() {
	

		var totalSN = averages.snCount * averages.sn;
		for (var i = 0; i < times.sn.length; i++) {
			totalSN += times.sn[i];
		}
		averages.snCount += times.sn.length;
		if (averages.snCount != 0) {
			averages.sn = totalSN / averages.snCount;
		}
		times.sn = [];

		var totalInit = averages.initCount * averages.init;
		for (var i = 0; i < times.init.length; i++) {
			totalInit += times.init[i];
		}
		averages.initCount += times.init.length;
		if (averages.initCount != 0) {
			averages.init = totalInit / averages.initCount;
		}
		times.init = [];


		var totalStartGame = averages.startGameCount * averages.startGame;
		for (var i = 0; i < times.startGame.length; i++) {
			totalStartGame += times.startGame[i];
		}
		averages.startGameCount += times.startGame.length;
		if (averages.startGameCount != 0){
			averages.startGame = totalStartGame / averages.startGameCount;
		}
		times.startGame = [];

		var totalPlay = averages.playCount * averages.play;
		for (var i = 0; i < times.play.length; i++) {
			totalPlay += times.play[i];
		}
		averages.playCount += times.play.length;
		if (averages.playCount != 0){
			averages.play = totalPlay /averages.playCount;
		}
		times.play = [];

		var totalPurchase = averages.purchaseCount * averages.purchase;
		for (var i = 0; i < times.purchase.length; i++) {
			totalPurchase += times.purchase[i];
		}
		averages.purchaseCount += times.purchase.length;
		if (averages.purchaseCount != 0) {
			averages.purchase = totalPurchase /averages.purchaseCount;
		}
		times.purchase = [];
	},
	
	update: function() {
		
		piggie.calculateAverages();
		var reportData = {};
		reportData.averages = JSON.parse(JSON.stringify(averages));
		reportData.errors = JSON.parse(JSON.stringify(errors));
		reportData.percent = Math.min(1.0, (Date.now() - startTime) / totalTime);

		if (!verbose) console.log(JSON.stringify(reportData));
		return reportData;
	}
};


// Processing the nodejs command-line parameters.
if (process.argv.length < 6) {
	// The client wasn't started properly; dump the usage statement and exit.
	console.log("Usage:");
	console.log("\tnode piggie.js --user=<id> --gsip=<game_server_ip> --lab=<lab_id> --snip=<social_network_ip> --time=<time_in_seconds> [--verbose]\n");
	console.log("See comments in the source code for details.");
	process.exit();
}

// DEFAULT ARGUMENTS
verbose = false;

// REQUIRED ARGUMENTS
var userId = 100000;
var totalTime = 10;
const toSeconds = 1000;
var lab = "lab1";
var gsip = "localhost"
var snip = "localhost"

process.argv.forEach(function(item, index, arr) {
	if (item.match(/^--user=/) != null){
		userId = parseInt(item.substring(7, item.length));
	} else if (item.match(/^--gsip=/) != null) {
		gsip = item.substring(7, item.length);
	} else if (item.match(/^--snip=/) != null) {
		snip = item.substring(7, item.length);
	} else if (item.match(/^--lab=/) != null) {
		lab = item.substring(6, item.length);
	} else if (item.match(/^--time=/) != null) {
		totalTime = parseInt(item.substring(7, item.length))*toSeconds;
	} else if (item == "--verbose") {
		verbose = true;
	}
});

gsURL = "http://" + gsip;
if (gsURL.charAt(gsURL.length-1) != "/") gsURL += "/";
gsURL += lab;
if (gsURL.charAt(gsURL.length-1) != "/") gsURL += "/";
gsURL += "server/";
	
snURL = "http://" + snip;
if (snURL.charAt(snURL.length-1) != "/") snURL += "/";
	

// Actions are run in "blocks".  The blocks array is a queue of pending actions.
// The actions themselves modify the items in the blocks array accordingly.
var blockDone = true;
var blocks = [ "sn" ];

// A data structure to record various lag times the user would experience.
var times = {
	sn: [],
	init: [],
	startGame: [],
	play: [],
	purchase: []
};

var averages = {
	sn: 0,
	snCount: 0,
	init: 0,
	initCount: 0,
	startGame: 0,
	startGameCount: 0,
	play: 0,
	playCount: 0,
	purchase: 0,
	purchaseCount: 0
};

var errors = {
	sn: 0,
	init: 0,
	startGame: 0,
	play: 0,
	purchase: 0
};




// ------------------------
//	 BEGIN SIMULATION!
// ------------------------
var startTime = Date.now();
var stopTime = startTime + totalTime;
var next = "sn";

// The master timer; every time it runs, it checks to see if the current
// block is done, and if so, moves to the next one.  Continues until time
// runs out, then generates a report.
var lastReportTime = startTime;
var reportInterval = 3000;
var masterTimer = setInterval(function() {
	if (blockDone) {
		blockDone = false;
		var currentTime = Date.now();
		var timeSinceLastReport = currentTime - lastReportTime;
		if (timeSinceLastReport >= reportInterval) {
			piggie.update();
			lastReportTime += reportInterval;
		}	
		if (currentTime < stopTime) {
			next = blocks.shift();
			if (next == "sn") piggie.sn();
			else if (next == "init") piggie.init();
			else if (next == "start_game") piggie.startGame();
			else if (next == "play") piggie.play();
			else if (next == "purchase") piggie.purchase();
		} else {
			// Time to report and exit.
			clearInterval(masterTimer);
			
			var reportData = piggie.update();
			var totalTime = currentTime - startTime;
			
			if (verbose) {
				console.log("Game Complete.");
				console.log(JSON.stringify(reportData));
				
				console.log("sn times: " + times.sn + " ms (" + errors.sn + " errors)");
				
				console.log("init times: " + reportData.averages.init + " ms (" + reportData.errors.init + " errors)");
				console.log("start_game times : " + reportData.averages.startGame + " ms (" + reportData.errors.startGame + " errors)");
				console.log("play times: " + reportData.averages.play + " ms (" + reportData.errors.play + " errors)");
				console.log("purchase times: " + reportData.averages.purchase + " ms (" + reportData.errors.purchase + " errors)");
				console.log("total time: " + totalTime + " ms");
				console.log("total errors: " + (reportData.errors.init + reportData.errors.startGame + reportData.errors.play + reportData.errors.purchase));
			} else {
				console.log(JSON.stringify(reportData));
			}
		}
	}
}, master_poll);

