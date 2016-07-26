/* globals describe, it, before, after */

'use strict';

var KwsSdk = require('../lib/kwsSdk');
var BPromise = require('bluebird');
var jwt = require('jsonwebtoken');
var _ = require('lodash');
var should = require('should');
var sinon = require('sinon');
var rp = require('request-promise');
var crypto = require('crypto');

describe('KwsSdk', function () {

    var sandbox;
    var stubs = {};
    var stubData;
    var kwsSdkOpts = {
        saAppId: 'test_app',
        saAppApiKey: 'test_key',
        kwsApiHost: 'https://kwsapi.test.superawesome.tv'
    };
    var kwsSdk = new KwsSdk(kwsSdkOpts);

    function getFunctionFromName(api, functionName) {
        var parts = functionName.split('.');
        var expectedFunction = api;
        for (var i = 0; i < parts.length; i++) {
            expectedFunction = expectedFunction[parts[i]];
        }

        return expectedFunction;     
    }

    function generateWebhookSignature(originalUrl, data, secretKey) {
        var signedData = originalUrl;

        for(var key in data) {
            signedData += key;
            signedData += data[key];
        }

        signedData += secretKey;

        return crypto.createHmac('sha1', secretKey).update(signedData).digest('hex').toString('base64');
    }

    beforeEach(function (done) {

        stubData = {
            token: '',
            resp: {}
        };

        sandbox = sinon.sandbox.create();

        stubs.post = sandbox.stub(rp, 'post', function (url, opts) {
            if (url === kwsSdkOpts.kwsApiHost + '/oauth/token') {
                return BPromise.resolve({access_token: stubData.token});
            } else {
                return BPromise.resolve(stubData.resp);
            }
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
            'app.user.getMap',
            'app.getStatistics',
            'app.notify'
        ], function (functionName) {
            it('should create ' + functionName, function (done) {
                var expectedFunction = getFunctionFromName(kwsSdk, functionName);
                should(typeof expectedFunction).eql('function');
                done();
            });
        });
    });

    describe('get token', function () {
        
        it('should request a token in the first call', function (done) {
            kwsSdk.app.user.getMap()
                .finally(function () {
                    should(stubs.post.callCount).eql(1);
                    done();
                });
        });
    });

    describe('api calls', function () {
        var appId = 1234;

        beforeEach(function (done) {
            stubData.token = jwt.sign({
                appId: appId,
                clientId: kwsSdkOpts.saAppId
            }, 'whatever', {});
            stubData.resp = {example: 'whatever'};
            done();
        });

        _.each([
            {
                functionName: 'app.user.getMap',
                expectedPath: '/v1/apps/' + appId + '/users/map',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'app.getStatistics',
                expectedPath: '/v1/apps/' + appId + '/statistics',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'app.notify',
                expectedPath: '/v1/apps/' + appId + '/notify',
                expectedMethod: 'post',
                params: {attribute: 'whatever'},
                expectedJson: {attribute: 'whatever'},
                expectedQs: undefined             
            }
        ], function (item) {
            it('should make a ' + item.expectedMethod + ' request to ' + item.expectedPath + 
                ' when calling ' + item.functionName, function (done) {

                var expectedFunction = getFunctionFromName(kwsSdk, item.functionName);

                expectedFunction(item.params)
                    .then(function (resp)  {
                        should(resp).eql(stubData.resp);
                        should(stubs[item.expectedMethod].callCount).eql(1);
                        should(stubs[item.expectedMethod].lastCall.args[0])
                            .eql(kwsSdkOpts.kwsApiHost + item.expectedPath);
                        should(stubs[item.expectedMethod].lastCall.args[1].json)
                            .eql(item.expectedJson);
                        should(stubs[item.expectedMethod].lastCall.args[1].qs)
                            .eql(item.expectedQs);
                        done();
                    });
            });
        });
    });

    describe('overriding endpoints', function () {
        var appId = 1234;
        var userId = 222;
        var customEndpoints = [
            'user.get',
            'user.update',
            'user.app.list',
            'user.app.create',
            'app.user.list'
        ];
        var customOpts = _.extend(kwsSdkOpts, {
            endpoints: customEndpoints
        });

        var customKwsApi = new KwsSdk(kwsSdkOpts);

        beforeEach(function (done) {
            stubData.token = jwt.sign({
                appId: appId,
                clientId: kwsSdkOpts.saAppId
            }, 'whatever', {});
            done();
        });

        _.each([
            {
                functionName: 'user.get',
                expectedPath: '/v1/users/' + userId,
                expectedMethod: 'get',
                params: {userId: userId},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'user.update',
                expectedPath: '/v1/users/' + userId,
                expectedMethod: 'put',
                params: {userId: userId, firstName: 'whatever'},
                expectedJson: {firstName: 'whatever'},
                expectedQs: undefined  
            },
            {
                functionName: 'user.app.list',
                expectedPath: '/v1/users/' + userId + '/apps',
                expectedMethod: 'get',
                params: {userId: userId},
                expectedJson: true,
                expectedQs: {}             
            },
            {
                functionName: 'user.app.create',
                expectedPath: '/v1/users/' + userId + '/apps',
                expectedMethod: 'post',
                params: {userId: userId, appId: appId},
                expectedJson: {appId: appId},
                expectedQs: undefined              
            },
            {
                functionName: 'app.user.list',
                expectedPath: '/v1/apps/' + appId + '/users',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            }
        ], function (item) {
            it('should make a ' + item.expectedMethod + ' request to ' + item.expectedPath + 
                ' when calling ' + item.functionName, function (done) {

                var expectedFunction = getFunctionFromName(customKwsApi, item.functionName);

                expectedFunction(item.params)
                    .then(function (resp)  {
                        should(resp).eql(stubData.resp);
                        should(stubs[item.expectedMethod].callCount).eql(1);
                        should(stubs[item.expectedMethod].lastCall.args[0])
                            .eql(kwsSdkOpts.kwsApiHost + item.expectedPath);
                        should(stubs[item.expectedMethod].lastCall.args[1].json)
                            .eql(item.expectedJson);
                        should(stubs[item.expectedMethod].lastCall.args[1].qs)
                            .eql(item.expectedQs);
                        should(stubs[item.expectedMethod].lastCall.args[1].headers['X-KWS-external-ids'])
                            .eql(undefined);
                        done();
                    });
            });
        });
    });

    describe('api call to an endpoint with userId and externalUserIds set in the init', function () {

        it('should make the request with the X-KWS-external-ids header set', function (done) {

            var appId = 1234;
            var userId = 222;
            var kwsSdk = new KwsSdk({
                saAppId: 'test_app',
                saAppApiKey: 'test_key',
                kwsApiHost: 'https://kwsapi.test.superawesome.tv',
                externalUserIds: true,
                endpoints: [
                    'user.app.create'
                ]
            });

            var expectedFunction = getFunctionFromName(kwsSdk, 'user.app.create');

            expectedFunction({userId: userId, appId: appId})
                .then(function (resp)  {
                    should(resp).eql(stubData.resp);
                    should(stubs.post.callCount).eql(2);
                    should(stubs.post.lastCall.args[0]).eql(kwsSdkOpts.kwsApiHost + '/v1/users/' + userId + '/apps');
                    should(stubs.post.lastCall.args[1].headers['X-KWS-external-ids']).eql(true);
                    done();
                });
        });
    });

    describe('webhook middleware', function () {
        it('should validate the signature', function(done){
            var secretKey = 'secretTestKey';
            var middleware = kwsSdk.validWebhookSignature(secretKey);
            var next = function(){
                should(true).eql(false);
            };

            var res = {
                sendStatus: function(val){
                    should(val).eql(401);
                }
            };

            var req = {
                originalUrl: '/webhook/endpoint',
                body: {
                    permissions: {
                        email: 'Denied',
                        firstName: 'Granted'
                    },
                },
                headers: {}
            };

            // first test with empty headers
            middleware(req, res, next);

            //with an invalid signature
            req.headers['x-kwsapi-signature'] = 'Invalid signature';
            middleware(req, res, next);

            //now with a valid signature
            req.headers['x-kwsapi-signature'] = generateWebhookSignature(req.originalUrl, req.body, secretKey);
            res.sendStatus = function(){
                should(true).eql(false);
            };
            next = function() {
               should(true).eql(true);
            };

            middleware(req, res, next);

            done();
        })
    });

});