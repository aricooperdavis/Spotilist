var urlInput = document.getElementById('urlInput');
var urlSubmit = document.getElementById('urlSubmit');
var outputBox = document.getElementById('outputBox');

// ----------------- Helper Functions --------------------------

function urlTest() {
	/* Parse url in input box */
	var urlAttempt = urlInput.value;
	regex = /^(https:\/\/|)(http:\/\/|)(www\.bbc\.co.uk\/)(sounds\/play\/|programmes\/).{8}$/g;
	match = urlAttempt.match(regex);
	/* Colour entry box based on url validity */
	if (match == null) {
		urlInput.style.outlineColor = "red";
		urlSubmit.disabled = true;
		urlSubmit.style.opacity = 0.4;
	} else {
		urlInput.style.outlineColor = "green";
		urlSubmit.disabled = false;
		urlSubmit.style.opacity = 1;
	};
};

// ----------------- Copied Functions --------------------------

function printToOutput(message) {
	/* Append message to output box and scroll to bottom */
	outputBox.value += message+"\n";
	outputBox.scrollTop = outputBox.scrollHeight;
}

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

/* Set-up authentication states for spotify request */
var stateKey = 'spotify_auth_state';
var outputLog = null;
var params = getHashParams();
var inputText = null;

var access_token = params.access_token,
    state = params.state,
    storedState = localStorage.getItem(stateKey);
		urlInput.value = localStorage.getItem(inputText)

function startProcess() {

	/* Authenticate with Spotify */

  var client_id = 'd40f63276ab440b68c98f06f10728393'; // Your client id
  var redirect_uri = 'https://spotilist.cooper-davis.net'; // Your redirect uri
	// var redirect_uri = 'http://localhost:8000';

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
	localStorage.setItem(inputText, urlInput.value);

  window.location = url;
};

/* If an access token has been given then we must have attempted authentication */
if (access_token && (state == null || state !== storedState)) {
  printToOutput("[ERROR] Failed Spotify authentication - please try again.");
} else {
  localStorage.removeItem(stateKey);
	localStorage.removeItem(inputText);
  if (access_token) {
		/* Make a call to the `me` endpoint to get logged in user details */
    $.ajax({
      url: 'https://api.spotify.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + access_token
      },
      success: function(response) {
				var user_id = response['id'];
        printToOutput("[OK] Authenticated as Spotify User: "+response['display_name']);

				/* Convert input url if necessary */
				var urlParts = urlInput.value.split("/");
				var soundUrl = "https://www.bbc.co.uk/sounds/play/"+urlParts[urlParts.length-1];

				/* Parse episode source from BBC Sounds */
				$.ajax({
					url: "https://cors-anywhere.herokuapp.com/"+soundUrl,
					success: function(response1) {
						/* Extract spotify uris*/
						var regex = /<title>.*<\/title>/g;
						var title = response1.match(regex)[0].slice(7, -8);
						printToOutput("[OK] Found episode: "+title);
						var regex = /<span class="sc-c-basic-tile__track-number gs-u-display-inline-block gel-pica-bold gs-u-ml0@m">/g
						var track_count = response1.match(regex).length;
						printToOutput("[OK] Found associated tracks: "+track_count);
						var regex = /[^"]*(open.spotify.com)[^"]*/g;
						var links = response1.match(regex);
						var track_uris = [];
						for (var i in links) {
							track_uris.push("spotify:track:"+links[i].split("/")[4]);
						};
						printToOutput("[OK] Found tracks on Spotify: "+track_uris.length);

						/* Create a playlist to put the tracks in */
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
								'description': 'Playlist generated by Spotilist at spotilist.cooper-davis.net'
							}),
							success: function(response2) {
								var playlist_url = response2['external_urls']['spotify'];
								var playlist_id = response2['id'];
								printToOutput("[OK] Created new empty playlist: "+playlist_url);

								/* Populate playlist with tracks */
								$.ajax({
									url: "https://api.spotify.com/v1/playlists/"+playlist_id+"/tracks",
									type: "POST",
									headers: {
										'Authorization': 'Bearer '+access_token,
										'Content-Type': 'application/json'
									},
									data: JSON.stringify({
										uris: track_uris
									}),
									success: function(response3) {
										printToOutput("[OK] Added tracks to playlist.");
										window.location(playlist_url);
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

	urlInput.addEventListener("input", urlTest, false);
	urlSubmit.addEventListener("click", startProcess, false);