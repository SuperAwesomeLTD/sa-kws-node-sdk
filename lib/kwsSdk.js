'use strict';

var BPromise = require('bluebird');
var rp = require('request-promise');
var router = require('./router');
var utils = require('./utils');
var crypto = require('crypto');
var _ = require('lodash');

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
     *  - externalUserIds: True if user IDs passed are external IDs (default false)     *
     *  - debug: add logs if set to true                                            *
     *  - logger: loger function, by default console.log                            *
     *  - language: 2 letter ISO code ("en" by default)                             *
     *  - hooks: Object where key is hook name and value is function which will be executed
     *  - customTokenEndpointHeader: custom header to be sent in the call to get a token *

         hooks.beforeRequest({
             method: method,
             path: path,
         })

         hooks.afterRequest({
             method: method,
             path: path,
             requestTime: time milis
         }, response)

         hooks.beforeEachRequest({
             method: method,
             path: path,
         })

         hooks.afterEachRequest({
             method: method,
             path: path,
             requestTime: time milis
         }, response)
          *
    */

    if (!(this instanceof KwsSdk)) {
        return new KwsSdk(opts);
    }

    var endpoints = {
        'v1': {
            'app.user.getMap': {
                'alias': null
            },
            'app.getStatistics': {
                'alias': null
            },
            'app.notify': {
                'alias': null
            }
        },
        'v2': {
            'app.user.getAppPoints': {
                alias: null
            },
            'app.user.getScore': {
                alias: null
            },
            'user.getPoints': {
                alias: 'app.user.getGlobalPoints'
            }
        }
    };

    var singularList = [];

    this.opts = opts || {};
    this.opts.logger = opts.logger || console.log;
    this.opts.allowedDomains = opts.allowedDomains || [];
    this.opts.externalUserIds = opts.externalUserIds || false;
    this.opts.language = this.opts.language || 'en';
    this.opts.hooks = this.opts.hooks || {};
    this.currentApiVersion = 2;

    this.bearerToken = null;

    this.router = router.createRouter(this.opts);

    var endpointList = _.merge(endpoints, this.opts.endpoints || {});
    singularList = singularList.concat(this.opts.singularList || []);
    this.apiFunctionFactory(endpointList, singularList);
}

// This functions are called when the sdk is instantiated
//*********************************************************************************
KwsSdk.prototype.createApiFunction = function (version, endpoint, options, singularList) {
    var self = this;

    //for old version we prepend the version number to the sdk function name
    if (version !== 'v' + self.currentApiVersion) {
        endpoint = version + '.' + endpoint;
        if (options.alias !== null) {
            options.alias = version + '.' + options.alias;
        }
    }

    var parts = endpoint.split('.');
    var optionsPart = options.alias ? options.alias.split('.') : null;
    var action = parts[parts.length - 1];
    var method = utils.getMethodFromAction(action);

    var lastLevel = self;
    for (var i = 0; i < parts.length - 1; i++) {
        lastLevel[parts[i]] = lastLevel[parts[i]] || {};
        lastLevel = lastLevel[parts[i]];
    }

    // This is the final function that is created
    var endpointCall = function (params) {
        params = params || {};

        return self.getClientCredentialsToken()
            .then(function (token) {
                var url = self.opts.kwsApiHost + utils.createPathFromEndpoint(version, endpoint, singularList, params, token);

                var opts = {
                    json: (method === 'get') ? true : params,
                    qs: (method === 'get') ? params : undefined
                };

                return self.makeRequest(method, url, opts);
            });
    };

    lastLevel[action] = endpointCall;

    if (optionsPart !== null) {
        var lastLevelAlias = self;

        for (var j = 0; j < optionsPart.length - 1; j++) {
            lastLevelAlias[optionsPart[j]] = lastLevelAlias[optionsPart[j]] || {};
            lastLevelAlias = lastLevelAlias[optionsPart[j]];
        }

        var aliasAction = optionsPart[optionsPart.length -1];
        lastLevelAlias[aliasAction] = endpointCall;
    }
};

KwsSdk.prototype.apiFunctionFactory = function (endpointList, singularList) {
    var self = this;

    for(var version in endpointList) {
        for(var endpoint in endpointList[version]) {
            var options = endpointList[version][endpoint];
            self.createApiFunction(version, endpoint, options, singularList);
        }
    }
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
        /*jshint camelcase: false */
        form: {
            grant_type: 'client_credentials'
        },
        /*jshint camelcase: true */
        json: true,
        resolveWithFullResponse: true
    };

    if (self.opts.customTokenEndpointHeader) {
        opts.headers = {};
        opts.headers[self.opts.customTokenEndpointHeader] = '1';
    }

    // Use optional scope
    if (self.opts.scope) {
        opts.form.scope = self.opts.scope;
    }

    return this.requestApi('post', tokenPath, opts)
        .then(function (resp) {
            /*jshint camelcase: false */
            self.bearerToken = resp.body.access_token;
            /*jshint camelcase: true */
            return self.bearerToken;
        });
};

var beforeEachRequestHook = function(context, method, path) {
    if (context.opts.hooks.beforeEachRequest && typeof context.opts.hooks.beforeEachRequest === 'function') {
        context.opts.hooks.beforeEachRequest({
            method: method,
            path: path,
        });
    }
};

var afterEachRequestHook = function(context, resp, method, path, startTime) {
    if (context.opts.hooks.afterEachRequest && typeof context.opts.hooks.afterEachRequest === 'function') {
        var endTime = Date.now();
        context.opts.hooks.afterEachRequest({
            method: method,
            path: path,
            requestTime: endTime - startTime
        }, resp);
    }
    return resp;
};

KwsSdk.prototype.requestApi = function(method, path, opts) {
    var self = this;
    var startTime = Date.now();
    beforeEachRequestHook(this, method, path);

    return rp[method](path, opts)
        .then(function (resp) {
            afterEachRequestHook(self, resp, method, path, startTime);
            return resp;
        })
        .catch(function(err){
            afterEachRequestHook(self, err, method, path, startTime);
            throw err;
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
    opts = opts || {};
    var startTime = Date.now();

    var afterRequestHook = function(resp) {
        if (self.opts.hooks.afterRequest && typeof self.opts.hooks.afterRequest === 'function') {
            var endTime = Date.now();
            self.opts.hooks.afterRequest({
                method: method,
                path: path,
                requestTime: endTime - startTime
            }, resp);
        }
        return resp;
    };

    var getQueryOpts = function() {
        var returnOpts = {
            json: opts.json,
            qs: opts.qs,
            headers: {
                'Authorization': 'Bearer ' + self.bearerToken,
                'Accept-Language': self.opts.language
            },
            resolveWithFullResponse: true
        }
        if (self.opts.externalUserIds) {
            returnOpts.headers['X-KWS-external-ids'] = true;
        }
        return returnOpts;
    }

    if (this.opts.hooks.beforeRequest && typeof this.opts.hooks.beforeRequest === 'function') {
        this.opts.hooks.beforeRequest({
            method: method,
            path: path,
        });
    }

    var requestSucceded = false;
    return this.requestApi(method, path, getQueryOpts())
        .then(function(resp) {
            requestSucceded = true;
            afterRequestHook(resp);
            return resp.body;
        })
        .catch(function (err) {
            if (err.statusCode === 401) {
                // If call fails, try getting the token again
                delete self.bearerToken;
                return self.getClientCredentialsToken()
                    .then(function () {
                        return self.requestApi(method, path, getQueryOpts());
                    })
                    .then(function(resp) {
                        afterRequestHook(resp);
                        return resp.body;
                    });
            }
            throw err;
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
        var data = req.body;

        if (signature === undefined) {
                res.sendStatus(401);

                if (self.opts.debug) {
                    self.opts.logger('Error in: validWebhookSignature middleware');
                    self.opts.logger('headers[x-kwsapi-signature] is undefined');
                }

        } else {
            var signedData = req.originalUrl;

            for(var key in data) {
                signedData += key;
                signedData += data[key];
            }

            signedData += secretKey;

            var currentSignature = crypto.createHmac('sha1', secretKey).update(signedData).digest('hex').toString('base64');

            if (currentSignature !== signature) {
                res.sendStatus(401);

                if (self.opts.debug) {
                    self.opts.logger('Error in: validWebhookSignature middleware');
                    self.opts.logger('headers[x-kwsapi-signature] is invalid, check your secretKey');
                }
            } else {
                next();
            }
        }
    };
};
//*********************************************************************************


KwsSdk.prototype.setLanguage = function (language) {
    this.opts.language = language;
};

module.exports = KwsSdk;
