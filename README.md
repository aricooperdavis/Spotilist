# Spotilist
*Create a spotify playlist from a BBC Sounds episode*

[Spotilist](https://aricooperdavis.github.io/Spotilist) is a site that automates the creation of new Spotify playlists containing tracks listed on a BBC Sounds episode.

![Screenshot of the User Interface](resources/screenshot.png)

## Get Started
### Online Demo Site
Try out the [fully functional demo-site](https://aricooperdavis.github.io/Spotilist/) built from this repository and running on GitHub pages.

The demo site uses my a personal CORS proxy server running [All Origins](https://github.com/gnuns/allOrigins). If you are thinking of hosting this yourself then consider spinning up your own CORS proxy rather than relying on mine.

### Host your own
I encourage you to host your own instance of this tool, so that you can build upon it and play with it! It's easy, just:

1. Clone the repository
2. Modify [lines 70 and 71 in spotilist.alpha.js](https://github.com/aricooperdavis/Spotilist/blob/master/spotilist.alpha.js#L70) so that the `redirect_uri` is appropriate. By default it points back to the demo site at [`spotilist.cooper-davis.net`](spotilist.cooper-davis.net) but if you're hosting it locally you will want to change this to `localhost` and the appropriate port.
3. Host it. Any server will do, such as Python's:

    `python -m http.server`

    which allows the site to be accessed at [`http://localhost:8000`](http://localhost:8000)

4. Host your own [All Origins Server](https://github.com/gnuns/allOrigins#on-your-own-server) so that you're not relying on my tiny Oracle Free Tier instance.

5. Register for a [spotify developer client ID](https://developer.spotify.com/dashboard/applications) so that you're not using mine all the time. You will need to modify [Line 69 of `spotilis.alpha.js`](https://github.com/aricooperdavis/Spotilist/blob/master/bbcspotilist.alpha.js#L63) to replace my client ID with yours. Note that you will need to [whitelist the redirect URI on your Spotify dashboard](https://developer.spotify.com/documentation/general/guides/app-settings/).

## Contributing
Please do - by filing any [issues](https://github.com/aricooperdavis/Spotilist/issues) you encounter or any [enhancements](https://github.com/aricooperdavis/Spotilist/labels/enhancement) you can think of, or even better by coding up those improvements yourself and making a [pull request](https://github.com/aricooperdavis/Spotilist/pulls).

## Acknowledgements
Many thanks to the developers of [All Origins](https://github.com/gnuns/allOrigins) and [jQuery](https://github.com/jquery/jquery) whose exceptional hard work has made this project simple.
