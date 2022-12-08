// ------------------- Custom Error ------------------------
class SkipError extends Error {
	constructor(message) {
		super(message);
		this.name = 'SkipError';
	}
}

window.addEventListener('unhandledrejection', function(event) {
	console.log(event.promise);
	alert(event.reason);
});

// ----------------- Helper Functions ----------------------

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

// ----------------- Spotify Authentication Code --------------------------

function getHashParams() {
	/* Parse hash in returned uri address */
	let hashParams = {};
	let e, r = /([^&;=]+)=?([^&;]*)/g,
		q = window.location.hash.substring(1);
	while ( (e = r.exec(q)) ) {
		hashParams[e[1]] = decodeURIComponent(e[2]);
	}
	return hashParams;
}

function generateRandomString(length) {
	/* Generate a random string to use as a state key */
	let text = '';
	let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (let i = 0; i < length; i++) {
	text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function getSpotifyAuth() {
	/* Authenticate with Spotify */

	let client_id = 'd40f63276ab440b68c98f06f10728393'; // Your client id
	let redirect_uri = 'https://spotilist.cooper-davis.net'; // Your redirect uri
	//let redirect_uri = 'http://localhost:8000';

	let state = generateRandomString(16);

	localStorage.setItem(stateKey, state);
	let scope = 'playlist-modify-private';

	let url = 'https://accounts.spotify.com/authorize';
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

// ----------------- Code runs on load --------------------------

// Tie vars to document elements
let urlInput = document.getElementById('urlInput');
let urlSubmit = document.getElementById('urlSubmit');
let outputBox = document.getElementById('outputBox');
let titleInput = document.getElementById('playlistTitleInput');
let descriptionInput = document.getElementById('playlistDescriptionInput');
let details = document.getElementById('details');

// Tie functions to element event listeners
urlInput.addEventListener("input", urlTest, false);
urlSubmit.addEventListener("click", getSpotifyAuth, false);

// Set-up state for spotify authentication
let stateKey = 'spotify_auth_state';
let params = getHashParams();
let access_token = params.access_token,
    state = params.state,
    storedState = localStorage.getItem(stateKey);

// Add values that need to survive redirects to localStorage
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
		fetch('https://api.spotify.com/v1/me', {
			headers: {
				'Authorization': 'Bearer ' + access_token
			}, 
		}).then( response => { 
			return response.json();
		}).catch( error => {
			console.log(error);
			printToOutput("[ERROR] Spotify authentication failed.");
			throw new SkipError();			

		// Get user_id and fetch sounds source
		}).then( response => {
			let user_id = response['id'];
			printToOutput("[OK] Authenticated as Spotify User: "+response['display_name']);
			
			let soundId = urlTest(urlInput.value);
			return Promise.all([
				{user_id: user_id},
				fetch(`http://132.145.67.16:1458/raw?url=${soundId}`).then(response => response.text())
			]);
		}).catch( error => {
			if (error.name != 'SkipError') {
				console.log(error);
				printToOutput("[ERROR] Cannot find that BBC Sounds Episode.");
			}
			throw new SkipError();

		// Parse sound HTML and create new playlist
		}).then( ([context, response]) => {
			try {
				let parser = new DOMParser();
				response = parser.parseFromString(response, 'text/html');
				Array.from(response.getElementsByTagName('script')).forEach(e => {
					if (e.innerHTML.startsWith(' window.__PRELOADED_STATE__')) {
						response = JSON.parse(e.innerHTML.trim().slice(29,-1)); // Liable to break
					}
				});
			
				// Playlist properties
				var title = (titleInput.value || Object.values(response.programmes.current.titles).slice(0,2).join(" - "));
				var description = (descriptionInput.value || "Automatically generated by Spotilist.");
				printToOutput("[OK] Found episode: "+title);
				
				let tracks = response.tracklist.tracks;
				if (tracks == null) {
					printToOutput("[ERROR] Cannot find any associated tracks.");
					throw new SkipError;
				}
				printToOutput("[OK] Found associated tracks: "+tracks.length);
				
				let links = tracks.filter(t => {
					return Object.values(t.uris).some(u => {
						return u.label == "Spotify";
					});
				});
				if (links == null) {
					printToOutput("[ERROR] Cannot find any tracks.");
					throw new SkipError;
				}
			
				context.track_uris = links.map(t => {
					return 'spotify:track:'+t.uris.filter(u => {
						return u.label == 'Spotify';
					})[0].uri.split('/')[4];
				}).flat();
				if (context.track_uris.length < 1) {
					printToOutput("[ERROR] Cannot find any tracks on Spotify.");
					throw new SkipError;
				}
				printToOutput("[OK] Found tracks on Spotify: "+context.track_uris.length);
			} catch (error) {
				console.log(error)
				printToOutput("[ERROR] Failed to parse Episode source!");
				throw new SkipError;
			}
			
			// Create a playlist to put the tracks in
			return Promise.all([
				context,
				fetch("https://api.spotify.com/v1/users/"+context.user_id+"/playlists", {
					method: 'POST',
					headers: {
						'Authorization': 'Bearer '+access_token,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						'name': title,
						'public': false,
						'description': description
					}),
				}).then(response => { return response.json() })
			]);
		}).catch( error => {
			if (error.name != 'SkipError') {
				console.log(error);
				printToOutput("[ERROR] Failed to create Spotify playlist");
			}
			throw new SkipError;

		// Populate new playlist with tracks
		}).then(([context, response]) => {
			context.playlist_url = response['external_urls']['spotify'];
			let playlist_id = response['id'];
			printToOutput("[OK] Created new empty playlist: "+context.playlist_url);
		
			return Promise.all([
				context,
				fetch("https://api.spotify.com/v1/playlists/"+playlist_id+"/tracks", {
					method: 'POST',
					headers: {
						'Authorization': 'Bearer '+access_token,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						'uris': context.track_uris
					}),
				})
			]);
		}).catch( error => {
			if (error.name != 'SkipError') {
				console.log(error);
				printToOutput("[ERROR] Failed to add tracks to playlist!")
			}
			throw new SkipError;

		}).then(([context, ]) => {
			printToOutput("[OK] Added tracks to playlist");
			urlSubmit.innerHTML = "Go!";
			window.location = context.playlist_url;
			printToOutput("[OK] Opening new playlist...");
		
		// Catch any other errors that aren't caught elsewhere
		}).catch(error => {
			console.log(error);
			printToOutput("[ERROR] Something went wrong! Check the console for details.");
		});
	}
}