// ----------------- Helper Functions --------------------------

function urlTest() {
	/* Parse url in input box */
	var urlAttempt = urlInput.value;
	regex = /^(https:\/\/|)(http:\/\/|)(www\.bbc\.co.uk\/)(sounds\/play\/|programmes\/).{8}$/g;
	match = urlAttempt.match(regex);

	// Colour entry box based on url validity
	if (match == null) {
		urlInput.style.outlineColor = "red";
		urlSubmit.disabled = true;
		urlSubmit.style.opacity = 0.4;
	} else {
		urlInput.style.outlineColor = "green";
		urlSubmit.disabled = false;
		urlSubmit.style.opacity = 1;
		urlSubmit.innerHTML = "Go!";
	};
};

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
  while ( e = r.exec(q)) {
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
};

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
};

// ----------------- Code runs on load --------------------------

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
      success: function(response) {
				var user_id = response['id'];
        printToOutput("[OK] Authenticated as Spotify User: "+response['display_name']);

				// Convert input url if necessary
				var urlParts = urlInput.value.split("/");
				var soundUrl = "https://www.bbc.co.uk/sounds/play/"+urlParts[urlParts.length-1];

				// Parse episode source from BBC Sounds
				$.ajax({
					url: "https://cors-anywhere.herokuapp.com/"+soundUrl,
					success: function(response1) {
						// Extract spotify uris
						var regex = /<title>.*<\/title>/g;
						var title = htmlDecode(response1.match(regex)[0].slice(7, -8));
						printToOutput("[OK] Found episode: "+title);
						var regex = /sc-c-basic-tile__track-number/g
						var tracks = response1.match(regex)

						if (tracks == null) {
							printToOutput("[ERROR] Cannot find any associated tracks.");
							return undefined;
						};

						var track_count = tracks.length;
						printToOutput("[OK] Found associated tracks: "+tracks.length);
						var regex = /[^"]*(open.spotify.com)[^"]*/g;
						var links = response1.match(regex);

						if (links == null) {
							printToOutput("[ERROR] Cannot find any tracks on spotify.");
							return undefined;
						}

						var track_uris = [];
						for (var i in links) {
							var this_uri = "spotify:track:"+links[i].split("/")[4];
							// Don't duplicate songs in the playlist
							if (!track_uris.includes(this_uri)) {
								track_uris.push(this_uri); 
							}
							
						};
						printToOutput("[OK] Found tracks on Spotify: "+track_uris.length);

						// Create a playlist to put the tracks in
						// Use a custom title and description if available
						if (titleInput.value !== ""){
							title = titleInput.value;
						};
						if (descriptionInput.value !== ""){
							var description = descriptionInput.value;
						} else {
							var description = 'Automatically generated by Spotilist.'
						}
						$.ajax({
							url: "https://api.spotify.com/v1/users/"+user_id+"/playlists",
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
							success: function(response2) {
								var playlist_url = response2['external_urls']['spotify'];
								var playlist_id = response2['id'];
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
										'uris': track_uris
									}),
									success: function(response3) {
										printToOutput("[OK] Added tracks to playlist.");
										urlSubmit.innerHTML = "Go!";
										window.location = playlist_url;
										printToOutput("[OK] Opening new playlist...");
									},
									error: function(response3){
										printToOutput("[ERROR] Failed to add tracks to playlist.");
										console.log(response3);
									}
								});

							},
							error: function(response2) {
								console.log(response2);
								printToOutput("[ERROR] Failed to create Spotify playlist.");
							}

						});
					},
					error: function(response1) {
						console.log(response1);
						printToOutput("[ERROR] Cannot find that BBC Sounds Episode.");
					}
				});

      }
    });

  }
}
