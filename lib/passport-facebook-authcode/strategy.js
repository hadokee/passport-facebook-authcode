/**
 * Module dependencies.
 */
var util = require('util')
  , OAuth2Strategy = require('passport-oauth').OAuth2Strategy
  , InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `FacebookAuthCodeStrategy` constructor.
 *
 * The Facebook authentication strategy authenticates requests by delegating to
 * Facebook using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 * 
 * Options:
 *   - `clientID`      your Facebook application's client id
 *   - `clientSecret`  your Facebook application's client secret
 *
 * Examples:
 *
 *     passport.use(new FacebookAuthCodeStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function FacebookAuthCodeStrategy(options, verify) {
  options = options || {};
  options.authorizationURL = options.authorizationURL || 'https://www.facebook.com/v2.2/dialog/oauth';
  options.tokenURL = options.tokenURL || 'https://graph.facebook.com/oauth/access_token';

  this._passReqToCallback = options.passReqToCallback;
  
  OAuth2Strategy.call(this, options, verify);
  this.name = 'facebook-authcode';
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(FacebookAuthCodeStrategy, OAuth2Strategy);


/**
 * Authenticate request by delegating to a service provider using OAuth 2.0.
 *
 * @param {Object} req
 * @api protected
 */
FacebookAuthCodeStrategy.prototype.authenticate = function(req, options) {
  options = options || {};
  var self = this;

  if (req.query && req.query.error) {
    // TODO: Error information pertaining to OAuth 2.0 flows is encoded in the
    //       query parameters, and should be propagated to the application.
    return this.fail();
  }

  if (!req.body) {
    return this.fail();
  }
  
  var authCode = req.body.code || req.query.code;
  //var redirectUri = req.protocol + '://' + req.get('host') + req.path;
  var redirectUri = req.body.redirectUri || req.query.redirectUri;


  if (!authCode) {
	  return this.fail();
  }
  
  self._exchangeAuthCode(authCode, redirectUri, function(err, accessToken, refreshToken, resultsJson) {
    if (err) { return self.fail(err); };

    self._loadUserProfile(accessToken, function(err, profile) {
      if (err) { return self.fail(err); };
      
      function verified(err, user, info) {
        if (err) { return self.error(err); }
        if (!user) { return self.fail(info); }
        self.success(user, info);
      }
      
      if (self._passReqToCallback) {
        self._verify(req, accessToken, refreshToken, profile, verified);
      } else {
        self._verify(accessToken, refreshToken, profile, verified);
      }
    });
  });
}

/**
 * Exchange authorization code for tokens
 *
 * @param {String} authCode
 * @param {Function} done
 * @api private
 */
FacebookAuthCodeStrategy.prototype._exchangeAuthCode = function(authCode, redirectUri, done) {
  var params = {
    'grant_type': 'authorization_code',
    'redirect_uri': redirectUri
  };
  this._oauth2.getOAuthAccessToken(authCode, params, done);
}


/**
 * Retrieve user profile from Facebook.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         always set to `facebook`
 *   - `id`
 *   - `username`
 *   - `displayName`
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
FacebookAuthCodeStrategy.prototype.userProfile = function(accessToken, done) {
  this._oauth2.get('https://graph.facebook.com/v2.2/me', accessToken, function (err, body, res) {
    if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }
    
    try {
      var json = JSON.parse(body);
      
      var profile = { provider: 'facebook' };
      profile.id = json.id;
      profile.displayName = json.name;
      profile.name = { familyName: json.family_name,
                       givenName: json.given_name };
      profile.emails = [{ value: json.email }];
      
      profile._raw = body;
      profile._json = json;
      
      done(null, profile);
    } catch(e) {
      done(e);
    }
  });
}


/**
 * Load user profile, contingent upon options.
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api private
 */
FacebookAuthCodeStrategy.prototype._loadUserProfile = function(accessToken, done) {
  var self = this;

  function loadIt() {
    return self.userProfile(accessToken, done);
  }
  function skipIt() {
    return done(null);
  }

  if (typeof this._skipUserProfile == 'function' && this._skipUserProfile.length > 1) {
    // async
    this._skipUserProfile(accessToken, function(err, skip) {
      if (err) { return done(err); }
      if (!skip) { return loadIt(); }
      return skipIt();
    });
  } else {
    var skip = (typeof this._skipUserProfile == 'function') ? this._skipUserProfile() : this._skipUserProfile;
    if (!skip) { return loadIt(); }
    return skipIt();
  }
}


/**
 * Expose `FacebookAuthCodeStrategy`.
 */ 
module.exports = FacebookAuthCodeStrategy;