var BPromise = require('bluebird');
var rp = require('request-promise');
var router = require('./router');
var utils = require('./utils');

function UserSdk(opts) {

    /* 
     *  Mandatory opts:                                                         *
     *  - kwsApiHost: KWS Host (https://kwsapi.superawesome.tv for example)     *
     *                                                                          *
     *  Optional opts:                                                          *
     *  - userToken: userToken                                                  *
     *  - appToken: token for the frontend (anonymous users)                    *
    */

    if (!this instanceof UserSdk) {
        return new UserSdk(opts);
    }

    var endpoints = [
        'user.get',
        'user.update',
        'user.inviteUser',
        'user.requestPermissions',
        'user.transaction.list',
        'user.triggerEvent',
        'user.hasTriggeredEvent',
        'user.notification.list',
        'user.notification.read',
        'app.leader.list',
        'app.getScore',
        'app.game.get',
        'app.game.getScore',
        'app.game.score',
        'app.competition.submitDrawing'
    ];

    this.opts = opts || {};
    this.bearerToken = this.opts.userToken || this.opts.appToken;

    this.apiFunctionFactory(endpoints);
}

UserSdk.prototype.getUserId = function () {
    var self = this;

    if (!utils.tokenActive(self.bearerToken)) {
        return null;
    }

    var tokenData = utils.parseTokenData(self.bearerToken);
    return tokenData ? tokenData.userId : null;
};

// This functions are called when the sdk is instantiated
//*********************************************************************************
UserSdk.prototype.createApiFunction = function (endpoint) {
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

        var url = self.opts.kwsApiHost + utils.createPathFromEndpoint(endpoint, params, self.bearerToken);

        var opts = {
            json: (method === 'get') ? true : params,
            qs: (method === 'get') ? params : undefined
        };

        return self.makeRequest(method, url, opts); 
            
    };
};

UserSdk.prototype.apiFunctionFactory = function (endpointList) {
    var self = this;

    endpointList.forEach(function (endpoint) {
        self.createApiFunction(endpoint);
    });
};
//*********************************************************************************

// This functions are called when an API call is made
//*********************************************************************************
UserSdk.prototype.makeRequest = function(method, path, opts) {
    var self = this;

    var opts = {
        json: opts.json,
        qs: opts.qs,
        headers: {
            'Authorization': 'Bearer ' + self.bearerToken
        }
    };

    return rp[method](path, opts);    
};
//*********************************************************************************

module.exports = UserSdk;