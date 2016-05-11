var BPromise = require('bluebird');
var rp = require('request-promise');
var router = require('./router');
var utils = require('./utils');
var crypto = require('crypto');

function KwsSdk(opts) {

    /*
     *  Mandatory opts:                                                             *
     *  - kwsApiHost: KWS Host (https://kwsapi.superawesome.tv for example)         *
     *  - apiKey: Api Key of the app                                                *
     *  - clientId: Name of the app                                                 *
     *                                                                              *
     *  Optional opts:                                                              *
     *  - scope: special scope requested for the token                              *
     *  - endpoints: list of additional endpoints to use (for specific clients)     *
     *  - singularList: list of word that are always singular (related to endpoints)*
     *  - cookieNameUser: Name of the user token cookie                             *
     *  - cookieNameApp: Name of the app token cookie                               *
     *  - headerNameUser: Name of the user header                                   *
     *  - headerNameApp: Name of the app header                                     *
     *  - loginRedirectUrl: if the login url is different than the current host     *
     *  - logoutRedirectUrl: if the logout url is different than the current host   *
     *  - allowedDomains: In case of cross domain login array of allowed domains    *
     *  - debug: add logs if set to true                                            *
     *  - logger: loger function, by default console.log                            *
    */

    if (!this instanceof KwsSdk) {
        return new KwsSdk(opts);
    }

    var endpoints = [
        'app.user.getMap',
        'app.getStatistics',
        'app.notify'
    ];

    var singularList = [];

    this.opts = opts || {};
    this.opts.logger = opts.logger || console.log;
    this.opts.allowedDomains = opts.allowedDomains || [];

    this.bearerToken = null;

    this.router = router.createRouter(this.opts);

    var endpointList = endpoints.concat(this.opts.endpoints || []);
    singularList = singularList.concat(this.opts.singularList || []);
    this.apiFunctionFactory(endpointList, singularList);
}

// This functions are called when the sdk is instantiated
//*********************************************************************************
KwsSdk.prototype.createApiFunction = function (endpoint, singularList) {
    var self = this;

    var parts = endpoint.split('.');
    var action = parts[parts.length - 1];
    var method = utils.getMethodFromAction(action);

    var lastLevel = self;
    for (var i = 0; i < parts.length - 1; i++) {
        lastLevel[parts[i]] = lastLevel[parts[i]] || {};
        lastLevel = lastLevel[parts[i]];
    }

    // This is the final function that is created
    lastLevel[action] = function (params) {
        params = params || {};

        return self.getClientCredentialsToken()
            .then(function (token) {
                var url = self.opts.kwsApiHost + utils.createPathFromEndpoint(endpoint, singularList, params, token);

                var opts = {
                    json: (method === 'get') ? true : params,
                    qs: (method === 'get') ? params : undefined
                };

                return self.makeRequest(method, url, opts);
            });
    };
};

KwsSdk.prototype.apiFunctionFactory = function (endpointList, singularList) {
    var self = this;

    endpointList.forEach(function (endpoint) {
        self.createApiFunction(endpoint, singularList);
    });
};
//*********************************************************************************
// This functions are called when an API call is made
//*********************************************************************************
KwsSdk.prototype.requestClientCredentialsToken = function () {
    var self = this;
    var tokenPath = self.opts.kwsApiHost + '/oauth/token';

    var opts = {
        auth: {
            user: self.opts.clientId,
            pass: self.opts.apiKey
        },
        form: {
            grant_type: 'client_credentials'
        },
        json: true
    };

    // Use optional scope
    if (self.opts.scope) {
        opts.form.scope = self.opts.scope;
    }

    return rp.post(tokenPath, opts)
        .then(function (resp) {
            self.bearerToken = resp.access_token;
            return self.bearerToken;
        });
};

KwsSdk.prototype.getClientCredentialsToken = function () {
    var self = this;

    if (self.bearerToken) {
        return BPromise.resolve(self.bearerToken);
    } else {
        return self.requestClientCredentialsToken();
    }
};

KwsSdk.prototype.makeRequest = function(method, path, opts) {
    var self = this;

    var opts = {
        json: opts.json,
        qs: opts.qs,
        headers: {
            'Authorization': 'Bearer ' + self.bearerToken
        }
    };

    return rp[method](path, opts)
        .catch(function () {
            // If call fails, try getting the token again
            delete self.bearerToken;
            return self.getClientCredentialsToken()
                .then(function () {
                    opts.headers = {'Authorization': 'Bearer ' + self.bearerToken};
                    return rp[method](path, opts);
                });
        });
};
//*********************************************************************************

//*********************************************************************************
// Webhooks part
//*********************************************************************************

// validate if the call is coming from KWS API
KwsSdk.prototype.validWebhookSignature = function(secretKey) {
    var self = this;

    return function(req, res, next) {
        var signature = req.headers['x-kwsapi-signature'];

        if (signature === undefined) {
                res.sendStatus('401');

                if (self.opts.debug) {
                    self.opts.logger('Error in: validWebhookSignature middleware');
                    self.opts.logger('headers[x-kwsapi-signature] is undefined');
                }

        } else {
            var signedData = req.originalUrl;

            for(var key in req.body) {
                signedData += key;
                signedData += data[key];
            }

            signedData += secretKey;

            var currentSignature = crypto.createHmac('sha1', secretKey).update(signedData).digest('hex').toString('base64');

            if (currentSignature !== signature) {
                res.sendStatus('401');

                if (self.opts.debug) {
                    self.opts.logger('Error in: validWebhookSignature middleware');
                    self.opts.logger('headers[x-kwsapi-signature] is invalid, check your secretKey');
                }
            } else {
                next();
            }
        }
    }
};
//*********************************************************************************

module.exports = KwsSdk;