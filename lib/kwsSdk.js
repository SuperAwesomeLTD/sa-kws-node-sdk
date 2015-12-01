var BPromise = require('bluebird');
var rp = require('request-promise');
var router = require('./router');
var utils = require('./utils');

function KwsSdk(opts) {

    /* 
     *  Mandatory opts:                                                         *
     *  - kwsApiHost: KWS Host (https://kwsapi.superawesome.tv for example)     *
     *  - apiKey: Api Key of the app                                            *
     *  - clientId: Name of the app                                             *
     *                                                                          *
     *  Optional opts:                                                          *
     *  - scope: special scope requested for the token                          *
     *  - endpoints: list of additional endpoints to use (for specific clients) *
    */

    if (!this instanceof KwsSdk) {
        return new KwsSdk(opts);
    }

    var endpoints = [
        'app.user.getMap',
        'app.getStatistics',
        'app.notify'        
    ];

    this.opts = opts || {};

    this.bearerToken = null;

    this.router = router.createRouter(this.opts);

    var endPointList = endpoints.concat(this.opts.endpoints || []);
    this.apiFunctionFactory(endPointList);
}

// This functions are called when the sdk is instantiated
//*********************************************************************************
KwsSdk.prototype.createApiFunction = function (endpoint) {
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
                var url = self.opts.kwsApiHost + utils.createPathFromEndpoint(endpoint, params, token);

                var opts = {
                    json: params.data || true,
                    qs: params.qs
                };

                return self.makeRequest(method, url, opts); 
            });
    };
};

KwsSdk.prototype.apiFunctionFactory = function (endpointList) {
    var self = this;

    endpointList.forEach(function (endpoint) {
        self.createApiFunction(endpoint);
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
        json: true || opts.json,
        headers: {
            'Authorization': 'Bearer ' + self.bearerToken
        },
        rejectUnauthorized: false || opts.rejectUnauthorized
    };

    return rp[method](path, opts)
        .catch(function () {
            // If call fails, try getting the token again
            return self.getClientCredentialsToken()
                .then(function () {
                    opts.headers = {'Authorization': 'Bearer ' + self.bearerToken};
                    return rp[method](path, opts);
                });
        });     
};
//*********************************************************************************

module.exports = KwsSdk;