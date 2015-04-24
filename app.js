var express       = require('express');
var bodyParser    = require('body-parser');
var request       = require('request');
var dotenv        = require('dotenv');
var SpotifyWebApi = require('spotify-web-api-node');

dotenv.load();

var spotifyApi = new SpotifyWebApi({
  clientId     : process.env.SPOTIFY_KEY,
  clientSecret : process.env.SPOTIFY_SECRET,
  redirectUri  : process.env.SPOTIFY_REDIRECT_URI
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

function addOrRemove(doWhat, req, res) {
  spotifyApi.refreshAccessToken()
    .then(function(data) {
      spotifyApi.searchTracks(req.body.text)
        .then(function(data) {
          var results = data.body.tracks.items;
          if (results.length === 0) {
            return res.send('Could not find that track.');
          }
          var trackId = results[0].id;
          spotifyApi[doWhat](process.env.SPOTIFY_USERNAME, process.env.SPOTIFY_PLAYLIST_ID, ['spotify:track:' + trackId])
            .then(function(data) {
              var msg = doWhat === 'addTracksToPlaylist' ? 'Track added!' : 'Track removed!';
              return res.send(msg);
            }, function(err) {
              return res.send(err.message);
            });
        }, function(err) {
          return res.send(err.message);
        });
    }, function(err) {
      return res.send('Could not referesh access token, you probably need to auth yourself again.');
    });
}

app.get('/', function(req, res) {
  if (spotifyApi.getAccessToken()) {
    return res.send('You are logged in.');
  }
  return res.send('<a href="/authorize">Authorize</a>');
});

app.get('/authorize', function(req, res) {
  var scopes = ['playlist-modify-public', 'playlist-modify-private'];
  var state  = new Date().getTime();
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  res.redirect(authorizeURL);
});

app.get('/callback', function(req, res) {
  spotifyApi.authorizationCodeGrant(req.query.code)
    .then(function(data) {
      spotifyApi.setAccessToken(data.body['access_token']);
      spotifyApi.setRefreshToken(data.body['refresh_token']);
      return res.redirect('/');
    }, function(err) {
      return res.send(err);
    });
});

app.use('/store', function(req, res, next) {
  var token = req.body.token;
  if (token !== process.env.SLACK_ADD_TOKEN && token !== process.env.SLACK_REMOVE_TOKEN) {
    return res.status(500).send('Cross site request forgerizzle!');
  }
  next();
});

app.post('/store', addOrRemove.bind(null, 'addTracksToPlaylist'));

// I know how HTTP verbs work, I promise, but Slack can only do a GET or POST.
app.post('/remove', addOrRemove.bind(null, 'removeTracksFromPlaylist'));

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));
