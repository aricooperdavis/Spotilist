// ----------------- Helper Functions --------------------------

function urlTest(urlAttempt) {
	/* Parse url in input box */
	if (typeof(urlAttempt) != 'string') {
		urlAttempt = urlInput.value;
	}
	let regex = /^(?:https:\/\/|)(?:http:\/\/|)(?:www\.bbc\.co.uk\/)(?:sounds\/play\/|programmes\/)(.{8})(?:\?.*|)$/;
	let match = urlAttempt.match(regex);

	// Colour entry box based on url validity
	if (match == null) {
		urlInput.className = "invalid";
		urlSubmit.className = "invalid";
		urlSubmit.disabled = true;
	} else {
		urlInput.className = "valid";
		urlSubmit.className = "valid";
		urlSubmit.disabled = false;
		urlSubmit.innerHTML = "Go!";

		match = match[1];
	}

	return match;
}

function printToOutput(message) {
	/* Append message to output box and scroll to bottom */
	outputBox.value += message+"\n";
	outputBox.scrollTop = outputBox.scrollHeight;
}

function htmlDecode(input){
	/* Decode's html that contains unicode characters
	source: https://stackoverflow.com/a/2808386/6144626 */
	var e = document.createElement('div');
	e.innerHTML = input;
	return e.childNodes[0].nodeValue;
}

// ----------------- Spotify Authentication Code --------------------------

function getHashParams() {
	/* Parse hash in returned uri address */
	var hashParams = {};
	var e, r = /([^&;=]+)=?([^&;]*)/g,
		q = window.location.hash.substring(1);
	while ( e = r.exec(q) ) {
		hashParams[e[1]] = decodeURIComponent(e[2]);
	}
	return hashParams;
}

function generateRandomString(length) {
	/* Generate a random string to use as a state key */
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) {
	text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function getSpotifyAuth() {
	/* Authenticate with Spotify */

	var client_id = 'd40f63276ab440b68c98f06f10728393'; // Your client id
	var redirect_uri = 'https://spotilist.cooper-davis.net'; // Your redirect uri
	//var redirect_uri = 'http://localhost:8000';

	var state = generateRandomString(16);

	localStorage.setItem(stateKey, state);
	var scope = 'playlist-modify-private';

	var url = 'https://accounts.spotify.com/authorize';
	url += '?response_type=token';
	url += '&client_id=' + encodeURIComponent(client_id);
	url += '&scope=' + encodeURIComponent(scope);
	url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
	url += '&state=' + encodeURIComponent(state);

	// Backup text box data
	localStorage.setItem('inputText', urlInput.value);
	localStorage.setItem('titleText', titleInput.value);
	localStorage.setItem('descriptionText', descriptionInput.value);
	localStorage.setItem('details', details.open);

	// Open spotify's URl, thereby leaving the site
	window.location = url;
	// We get redirected back here by Spotify after authentication
}

// ----------------- Callbacks -----------------

function handleLoggedInUser (response) {
	var user_id = response['id'];
	printToOutput("[OK] Authenticated as Spotify User: "+response['display_name']);

	// Strip query params and get episode code from URL input
	var soundUrl = "https://www.bbc.co.uk/sounds/play/"+urlTest(urlInput.value);

	// Get episode source from BBC Sounds
	$.ajax({
		url: "https://api.allorigins.win/raw?url="+soundUrl,
		success: parseSoundSource,
		context: {
			user_id: user_id,
		},
		error: function (response) {
			console.log(response);
			printToOutput("[ERROR] Cannot find that BBC Sounds Episode.");
		}
	});
}

function parseSoundSource (response) {
	// Parse response
	let parser = new DOMParser();
	response = parser.parseFromString(response, 'text/html');
	Array.from(response.getElementsByTagName('script')).forEach(e => {
		if (e.innerHTML.startsWith(' window.__PRELOADED_STATE__')) {
			response = JSON.parse(e.innerHTML.trim().slice(29,-1)); // Liable to break
		}
	});

	// Extract useful bits
	let title = Object.values(response.programmes.current.titles).slice(0,2).join(" - ");
	printToOutput("[OK] Found episode: "+title);
	
	var tracks = response.tracklist.tracks;
	if (tracks == null) {
		printToOutput("[ERROR] Cannot find any associated tracks.");
		return undefined;
	}
	printToOutput("[OK] Found associated tracks: "+tracks.length);
	
	let links = tracks.filter(t => {
		return Object.values(t.uris).some(u => {
			return u.label == "Spotify";
		});
	});
	if (links == null) {
		printToOutput("[ERROR] Cannot find any tracks.");
		return undefined;
	}

	let track_uris = links.map(t => {
		return 'spotify:track:'+t.uris.filter(u => {
			return u.label == 'Spotify';
		})[0].uri.split('/')[4];
	}).flat();
	if (track_uris.length < 1) {
		printToOutput("[ERROR] Cannot find any tracks on Spotify.");
		return undefined;
	}
	printToOutput("[OK] Found tracks on Spotify: "+track_uris.length);

	// Create a playlist to put the tracks in
	// Use a custom title and description if available
	if (titleInput.value !== ""){
		title = titleInput.value;
	}
	if (descriptionInput.value !== ""){
		var description = descriptionInput.value;
	} else {
		var description = 'Automatically generated by Spotilist.'
	}
	$.ajax({
		url: "https://api.spotify.com/v1/users/"+this.user_id+"/playlists",
		type: "POST",
		headers: {
			'Authorization': 'Bearer '+access_token,
			'Content-Type': 'application/json'
		},
		data: JSON.stringify({
			'name': title,
			'public': false,
			'description': description
		}),
		context: {
			track_uris: track_uris,
		},
		success: handleNewPlaylist,
		error: function (response) {
			console.log(response);
			printToOutput("[ERROR] Failed to create Spotify playlist.");
		}
	});
}

function handleNewPlaylist (response) {
	var playlist_url = response['external_urls']['spotify'];
	var playlist_id = response['id'];
	printToOutput("[OK] Created new empty playlist: "+playlist_url);

	// Populate playlist with tracks
	$.ajax({
		url: "https://api.spotify.com/v1/playlists/"+playlist_id+"/tracks",
		type: "POST",
		headers: {
			'Authorization': 'Bearer '+access_token,
			'Content-Type': 'application/json'
		},
		data: JSON.stringify({
			'uris': this.track_uris
		}),
		context: {
			playlist_url: playlist_url,
		},
		success: handleTracksAdded,
		error: function (response){
			printToOutput("[ERROR] Failed to add tracks to playlist.");
			console.log (response);
		}
	});
}

function handleTracksAdded () {
	printToOutput("[OK] Added tracks to playlist.");
	urlSubmit.innerHTML = "Go!";
	window.location = this.playlist_url;
	printToOutput("[OK] Opening new playlist...");
}

// ----------------- Code runs on load --------------------------

// Ensure jQuery is loaded or failover locally
window.jQuery || document.write('<script src="js/jquery-3.6.1.min.js"></script>');

// Tie vars to document elements
var urlInput = document.getElementById('urlInput');
var urlSubmit = document.getElementById('urlSubmit');
var outputBox = document.getElementById('outputBox');
var titleInput = document.getElementById('playlistTitleInput');
var descriptionInput = document.getElementById('playlistDescriptionInput');
var details = document.getElementById('details');

// Tie functions to event listeners on elements
urlInput.addEventListener("input", urlTest, false);
urlSubmit.addEventListener("click", getSpotifyAuth, false);

// Set-up state for spotify authentication
var stateKey = 'spotify_auth_state';
var params = getHashParams();

var access_token = params.access_token,
    state = params.state,
    storedState = localStorage.getItem(stateKey);

// Set-up other values that need to survive redirects
urlInput.value = localStorage.getItem('inputText');
titleInput.value = localStorage.getItem('titleText');
descriptionInput.value = localStorage.getItem('descriptionText');
details.open = (localStorage.getItem('details') == 'true');
localStorage.removeItem('inputText');
localStorage.removeItem('titleText');
localStorage.removeItem('descriptionText');
localStorage.removeItem('details');

// If an access token has been given then we must have attempted authentication
if (access_token && (state == null || state !== storedState)) {
	printToOutput("[ERROR] Failed Spotify authentication - please try again.");
	details.open = true;
	urlSubmit.innerHTML = "Error!";
} else {
	// Remove auth stateKey once authorisation has been issued
	localStorage.removeItem(stateKey);

	if (access_token) {
		urlSubmit.innerHTML = "Wait...";
		// Make a call to the `me` endpoint to get logged in user details
		$.ajax({
			url: 'https://api.spotify.com/v1/me',
			headers: {
				'Authorization': 'Bearer ' + access_token
			},
			success: handleLoggedInUser,
			error: function (response) {
				console.log(response);
				printToOutput("[ERROR] Cannot find that BBC Sounds Episode.");
			}
		});
	}
}
