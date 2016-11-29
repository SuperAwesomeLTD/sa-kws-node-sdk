'use strict';

var rp = require('request-promise');
var utils = require('./utils');

function UserSdk(opts) {

    /*
     *  Mandatory opts:                                                          *
     *  - kwsApiHost:  KWS Host (https: //kwsapi.superawesome.tv for example)    *
     *                                                                           *
     *  Optional opts:                                                           *
     *  - language: 2 letter ISO code ('en' by default)                          *
     *  - userToken:  userToken                                                  *
     *  - appToken:  token for the frontend (anonymous users)                    *
    */

    if (!(this instanceof UserSdk)) {
        return new UserSdk(opts);
    }

    var endpoints = {
        'v1': {
            'app.competition.submitDrawing': {
                'alias': null
            },
            'app.event.list': {
                'alias': null
            },
            'app.event.create': {
                'alias': null
            },
            'app.event.delete': {
                'alias': null
            },
            'app.event.update': {
                'alias': null
            },
            'app.game.leader.list': {
                'alias': null
            },
            'app.game.list': {
                'alias': null
            },
            'app.game.get': {
                'alias': null
            },
            'app.game.score': {
                'alias': null
            },
            'app.game.getScore': {
                'alias': null
            },
            'app.leader.list': {
                'alias': null
            },
            'app.randomName.list': {
                'alias': null
            },
            'app.randomName.update': {
                'alias': null
            },
            'app.scheduledNotification.list': {
                'alias': null
            },
            'app.scheduledNotification.get': {
                'alias': null
            },
            'app.scheduledNotification.create': {
                'alias': null
            },
            'app.scheduledNotification.update': {
                'alias': null
            },
            'app.scheduledNotification.delete': {
                'alias': null
            },
            'app.scheduledNotification.markAsSent': {
                'alias': null
            },
            'app.user.appData.list': {
                'alias': null
            },
            'app.user.appData.set': {
                'alias': null
            },
            'app.user.appData.deleteByName': {
                'alias': null
            },
            'app.user.transaction.list': {
                'alias': null
            },
            'app.user.list': {
                'alias': null
            },
            'app.user.get': {
                'alias': null
            },
            'app.user.create': {
                'alias': null
            },
            'app.user.update': {
                'alias': null
            },
            'app.user.getBirthdays': {
                'alias': null
            },
            'app.user.getWelcomePackages': {
                'alias': null
            },
            'app.user.getMap': {
                'alias': null
            },
            'app.user.authenticate': {
                'alias': null
            },
            'app.user.subscribePushNotifications': {
                'alias': null
            },
            'app.user.unsubscribePushNotifications': {
                'alias': null
            },
            'app.user.getLanguages': {
                'alias': null
            },
            'app.user.getHasDeviceToken': {
                'alias': null
            },
            'app.webhook.list': {
                'alias': null
            },
            'app.webhook.create': {
                'alias': null
            },
            'app.webhook.delete': {
                'alias': null
            },
            'app.create': {
                'alias': null
            },
            'app.update': {
                'alias': null
            },
            'app.list': {
                'alias': null
            },
            'app.getCheckUsername': {
                'alias': null
            },
            'app.getScore': {
                'alias': null
            },
            'app.getStatistics': {
                'alias': null
            },
            'app.getStats': {
                'alias': null
            },
            'app.notify': {
                'alias': null
            },
            'app.get': {
                'alias': null
            },
            'app.getConfig': {
                'alias': null
            },
            'currency.get': {
                'alias': null
            },
            'currency.create': {
                'alias': null
            },
            'currency.patch': {
                'alias': null
            },
            'currency.list': {
                'alias': null
            },
            'user.app.create': {
                'alias': null
            },
            'user.app.list': {
                'alias': null
            },
            'user.app.update': {
                'alias': null
            },
            'user.app.getActivationUsername': {
                'alias': null
            },
            'user.app.updateUsername': {
                'alias': null
            },
            'user.itemTransaction.delete': {
                'alias': null
            },
            'user.notification.list': {
                'alias': null
            },
            'user.notification.read': {
                'alias': null
            },
            'user.pendingTransaction.create': {
                'alias': null
            },
            'user.pendingTransaction.delete': {
                'alias': null
            },
            'user.pendingTransaction.replace': {
                'alias': null
            },
            'user.transaction.list': {
                'alias': null
            },
            'user.transaction.delete': {
                'alias': null
            },
            'user.transaction.validate': {
                'alias': null
            },
            'user.list': {
                'alias': null
            },
            'user.create': {
                'alias': null
            },
            'user.get': {
                'alias': null
            },
            'user.update': {
                'alias': null
            },
            'user.forgotPassword': {
                'alias': null
            },
            'user.resetPassword': {
                'alias': null
            },
            'user.changePassword': {
                'alias': null
            },
            'user.triggerEvent': {
                'alias': null
            },
            'user.hasTriggeredEvent': {
                'alias': null
            },
            'user.requestPermissions': {
                'alias': null
            },
            'user.inviteUser': {
                'alias': null
            },
            'user.getAppPermissions': {
                'alias': null
            },
            'user.getEmailPlusData': {
                'alias': null
            },
            'user.getPoints': {
                'alias': null
            },
            'user.deleteAccount': {
                'alias': null
            },
            'user.purgeDeleted': {
                'alias': null
            }
        },
        'v2': {
            'app.event.list': {
                'alias': null
            },
            'app.scheduledNotification.list': {
                'alias': null
            },
            'app.user.get': {
                'alias': null
            },
            'app.user.getPoints': {
                'alias': null
            },
            'app.user.delete': {
                'alias': null
            },
            'app.user.list': {
                'alias': null
            },
            'app.user.getScore': {
                'alias': null
            },
            'app.getIntegration': {
                'alias': null
            },
            'user.getPoints': {
                'alias': null
            },
            'user.getModified': {
                'alias': null
            }
        }
    };

    var singularList = ['appData'];

    this.opts = opts || {};
    this.currentApiVersion = 2;
    this.opts.language = this.opts.language || 'en';
    this.bearerToken = this.opts.userToken || this.opts.appToken;
    singularList = singularList.concat(this.opts.singularList || []);

    this.apiFunctionFactory(endpoints, singularList);
}

UserSdk.prototype.getUserId = function () {
    var self = this;

    if (!utils.tokenActive(self.bearerToken)) {
        return null;
    }

    var tokenData = utils.parseTokenData(self.bearerToken);
    return tokenData ? tokenData.userId :  null;
};

// This functions are called when the sdk is instantiated
//*********************************************************************************
UserSdk.prototype.createApiFunction = function (version, endpoint, options, singularList) {
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

    var endpointCall = function (params) {
        params = params || {};

        var url = self.opts.kwsApiHost + utils.createPathFromEndpoint(version, endpoint, singularList, params, self.bearerToken);

        var opts = {
            json: (method === 'GET') ? null : params,
            qs: (method === 'GET') ? params : null
        };

        return self.makeRequest(method, url, opts);
    };


    var lastLevel = self;
    for (var i = 0; i < parts.length - 1; i++) {
        lastLevel[parts[i]] = lastLevel[parts[i]] || {};
        lastLevel = lastLevel[parts[i]];
    }

    lastLevel[action] = endpointCall;

    if (optionsPart !== null) {
        var lastLevelAlias = self;
        for (var j = 0; j < optionsPart.length - 1; j++) {
            lastLevelAlias[optionsPart[j]] = lastLevelAlias[optionsPart[j]] || {};
            lastLevelAlias = lastLevelAlias[optionsPart[j]];
        }

        lastLevelAlias[action] = endpointCall;
    }
};

UserSdk.prototype.apiFunctionFactory = function (endpointList, singularList) {
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
UserSdk.prototype.makeRequest = function(method, path, opts) {
    var self = this;

    var returnOpts = {
        json:  opts.json,
        qs:  opts.qs,
        headers:  {
            'Authorization':  'Bearer ' + self.bearerToken
        }
    };

    return rp[method](path, returnOpts);
};
//*********************************************************************************

module.exports = UserSdk;
