/* globals describe, it, before, after */

'use strict';

var UserSdk = require('../lib/userSdk');
var BPromise = require('bluebird');
var jwt = require('jsonwebtoken');
var _ = require('lodash');
var should = require('should');
var sinon = require('sinon');
var rp = require('request-promise');

describe('UserSdk', function () {
    var tokenData = {
        appId: 1234,
        clientId: 'test_app',
        userId: 222
    };

    var sandbox;
    var stubs = {};
    var stubData;
    var userSdkOpts = {
        kwsApiHost: 'https://kwsapi.test.superawesome.tv',
        userToken: jwt.sign(tokenData, 'whatever', {})
    };
    var userSdk = new UserSdk(userSdkOpts);

    function getFunctionFromName(api, functionName) {
        var parts = functionName.split('.');
        var expectedFunction = api;
        for (var i = 0; i < parts.length; i++) {
            expectedFunction = expectedFunction[parts[i]];
        }

        return expectedFunction;     
    }

    beforeEach(function (done) {

        stubData = {
            resp: {}
        };

        sandbox = sinon.sandbox.create();

        stubs.post = sandbox.stub(rp, 'post', function (url, opts) {

            return BPromise.resolve(stubData.resp);
            
        });

        stubs.get = sandbox.stub(rp, 'get', function (url, opts) {
            return BPromise.resolve(stubData.resp);
        });

        stubs.put = sandbox.stub(rp, 'put', function (url, opts) {
            return BPromise.resolve(stubData.resp);
        });

        stubs.del = sandbox.stub(rp, 'del', function (url, opts) {
            return BPromise.resolve(stubData.resp);
        });

        done();
    });

    afterEach(function (done) {
        sandbox.restore();
        done();
    });

    describe('default endpoints', function () {

        _.each([
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
        ], function (functionName) {
            it('should create ' + functionName, function (done) {
                var expectedFunction = getFunctionFromName(userSdk, functionName);
                should(typeof expectedFunction).eql('function');
                done();
            });
        });
    });

    describe('api calls', function () {

        _.each([
            {
                functionName: 'user.get',
                expectedPath: '/v1/users/' + tokenData.userId,
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'user.update',
                expectedPath: '/v1/users/' + tokenData.userId,
                expectedMethod: 'put',
                params: {firstName: 'whatever'},
                expectedJson: {firstName: 'whatever'},
                expectedQs: undefined
            },
            {
                functionName: 'user.inviteUser',
                expectedPath: '/v1/users/' + tokenData.userId + '/invite-user',
                expectedMethod: 'post',
                params: {email: 'whatever@whatever.com'},
                expectedJson: {email: 'whatever@whatever.com'},
                expectedQs: undefined             
            },
            {
                functionName: 'user.requestPermissions',
                expectedPath: '/v1/users/' + tokenData.userId + '/request-permissions',
                expectedMethod: 'post',
                params: {permissions: ['email', 'address']},
                expectedJson: {permissions: ['email', 'address']},
                expectedQs: undefined                  
            },
            {
                functionName: 'user.transaction.list',
                expectedPath: '/v1/users/' + tokenData.userId + '/transactions',
                expectedMethod: 'get',
                params: {limit: 100},
                expectedJson: true,
                expectedQs: {limit: 100}               
            },
            {
                functionName: 'user.triggerEvent',
                expectedPath: '/v1/users/' + tokenData.userId + '/trigger-event',
                expectedMethod: 'post',
                params: {token: 'whatever'},
                expectedJson: {token: 'whatever'},
                expectedQs: undefined                  
            },
            {
                functionName: 'user.triggerEvent',
                expectedPath: '/v1/users/' + tokenData.userId + '/trigger-event',
                expectedMethod: 'post',
                params: {token: 'whatever'},
                expectedJson: {token: 'whatever'},
                expectedQs: undefined                  
            },
            {
                functionName: 'user.hasTriggeredEvent',
                expectedPath: '/v1/users/' + tokenData.userId + '/has-triggered-event',
                expectedMethod: 'post',
                params: {token: 'whatever'},
                expectedJson: {token: 'whatever'},
                expectedQs: undefined                  
            },
            {
                functionName: 'user.notification.list',
                expectedPath: '/v1/users/' + tokenData.userId + '/notifications',
                expectedMethod: 'get',
                params: {limit: 100},
                expectedJson: true,
                expectedQs: {limit: 100}               
            },
            {
                functionName: 'user.notification.read',
                expectedPath: '/v1/users/' + tokenData.userId + '/notifications/' + 123 + '/read',
                expectedMethod: 'post',
                params: {notificationId: 123},
                expectedJson: {},
                expectedQs: undefined              
            },
            {
                functionName: 'app.leader.list',
                expectedPath: '/v1/apps/' + tokenData.appId + '/leaders',
                expectedMethod: 'get',
                params: {limit: 100},
                expectedJson: true,
                expectedQs: {limit: 100}               
            },
            {
                functionName: 'app.getScore',
                expectedPath: '/v1/apps/' + tokenData.appId + '/score',
                expectedMethod: 'get',
                params: {start: 123456789000, end: 123459876000},
                expectedJson: true,
                expectedQs: {start: 123456789000, end: 123459876000}               
            },
            {
                functionName: 'app.game.get',
                expectedPath: '/v1/apps/' + tokenData.appId + '/games/' + 54321,
                expectedMethod: 'get',
                params: {gameId: 54321},
                expectedJson: true,
                expectedQs: {}               
            },
            {
                functionName: 'app.game.getScore',
                expectedPath: '/v1/apps/' + tokenData.appId + '/games/' + 54321 + '/score',
                expectedMethod: 'get',
                params: {gameId: 54321, start: 123456789000, end: 123459876000},
                expectedJson: true,
                expectedQs: {start: 123456789000, end: 123459876000}              
            },
            {
                functionName: 'app.game.score',
                expectedPath: '/v1/apps/' + tokenData.appId + '/games/' + 54321 + '/score',
                expectedMethod: 'post',
                params: {gameId: 54321, levelId: 12345, points: 100},
                expectedJson: {levelId: 12345, points: 100},
                expectedQs: undefined          
            },
            {
                functionName: 'app.competition.submitDrawing',
                expectedPath: '/v1/apps/' + tokenData.appId + '/competitions/' + 111 + '/submit-drawing',
                expectedMethod: 'post',
                params: {competitionId: 111, imageData: 'whatever'},
                expectedJson: {imageData: 'whatever'},
                expectedQs: undefined          
            }
        ], function (item) {
            it('should make a ' + item.expectedMethod + ' request to ' + item.expectedPath + 
                ' when calling ' + item.functionName, function (done) {

                var expectedFunction = getFunctionFromName(userSdk, item.functionName);

                expectedFunction(item.params)
                    .then(function (resp)  {
                        should(resp).eql(stubData.resp);
                        should(stubs[item.expectedMethod].callCount).eql(1);
                        should(stubs[item.expectedMethod].lastCall.args[0])
                            .eql(userSdkOpts.kwsApiHost + item.expectedPath);
                        should(stubs[item.expectedMethod].lastCall.args[1].json)
                            .eql(item.expectedJson);
                        should(stubs[item.expectedMethod].lastCall.args[1].qs)
                            .eql(item.expectedQs);
                        done();
                    });
            });
        });
    });

    describe('get user id', function () {
        it('should return the user id', function () {
            var userId = userSdk.getUserId();
            should(userId).eql(222);
        });

        describe('no token', function () {
            var testUserSdk = new UserSdk({});
            
            it('should return null', function () {
                var userId = testUserSdk.getUserId();
                should(userId).eql(null);
            });
        });
    });

});