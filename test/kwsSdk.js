/* globals describe, it, beforeEach, afterEach */

'use strict';

const KwsSdk = require('../lib/kwsSdk');
const BPromise = require('bluebird');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const should = require('should');
const sinon = require('sinon');
const rp = require('request-promise');
const crypto = require('crypto');

describe('KwsSdk', function () {
    let sandbox;
    let stubs = {};
    let stubData;
    let kwsSdkOpts = {
        saAppId: 'test_app',
        saAppApiKey: 'test_key',
        kwsApiHost: 'https://kwsapi.test.superawesome.tv',
        customTokenEndpointHeader: 'x-custom-token-header'
    };
    let kwsSdk = new KwsSdk(kwsSdkOpts);

    function getFunctionFromName(api, functionName) {
        let parts = functionName.split('.');
        let expectedFunction = api;
        for (let i = 0; i < parts.length; i++) {
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
            resp: {
                body: {
                    testData: 123
                }
            }
        };

        sandbox = sinon.sandbox.create();

        stubs.post = sandbox.stub(rp, 'post').callsFake(function (url) {
            if (url === kwsSdkOpts.kwsApiHost + '/oauth/token') {
                return BPromise.resolve({body: {access_token: stubData.token}}); // jshint ignore:line
            } else {
                return BPromise.resolve(stubData.resp);
            }
        });

        stubs.get = sandbox.stub(rp, 'get').callsFake(function () {
            return BPromise.resolve(stubData.resp);
        });

        stubs.put = sandbox.stub(rp, 'put').callsFake(function () {
            return BPromise.resolve(stubData.resp);
        });

        stubs.del = sandbox.stub(rp, 'del').callsFake(function () {
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
            'v1.app.user.getMap',
            'v1.app.getStatistics',
            'v1.app.notify',
            'app.user.getScore',
            'app.user.getAppPoints',
            'app.user.getGlobalPoints'
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
            kwsSdk.v1.app.user.getMap()
                .finally(function () {
                    should(stubs.post.callCount).eql(1);
                    done();
                });
        });

        it('should send the custom header in the token call', () => {
            return kwsSdk.v1.app.user.getMap()
            .finally(function () {
                should(stubs.post.callCount).eql(1);
                should(stubs.post.firstCall.args[1].headers['x-custom-token-header']).eql('1');
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
            stubData.resp = {body: {example: 'whatever'}};
            done();
        });

        _.each([
            {
                functionName: 'v1.app.user.getMap',
                expectedPath: '/v1/apps/' + appId + '/users/map',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'v1.app.getStatistics',
                expectedPath: '/v1/apps/' + appId + '/statistics',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'v1.app.notify',
                expectedPath: '/v1/apps/' + appId + '/notify',
                expectedMethod: 'post',
                params: {attribute: 'whatever'},
                expectedJson: {attribute: 'whatever'},
                expectedQs: undefined
            }
        ], function (item) {
            it('should make a ' + item.expectedMethod + ' request to ' + item.expectedPath +
                ' when calling ' + item.functionName + ' and execute hooks', function (done) {

                let expectedFunction = getFunctionFromName(kwsSdk, item.functionName);

                expectedFunction(item.params)
                    .then(function (resp)  {
                        should(resp).eql(stubData.resp.body);
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

    describe('extending with hooks', function () {
        let appId = 1234;
        let hooksOpts = _.clone(kwsSdkOpts);
        hooksOpts.hooks = {
            beforeRequest: function() {}, //yes it's needed
            afterRequest: function() {}, //yes it's needed
            afterEachRequest: function() {}, //yes it's needed
            beforeEachRequest: function() {} //yes it's needed
        };
        let kwsApiWithHooks = new KwsSdk(hooksOpts);
        let spies = {};
        spies.beforeRequest = sinon.spy(hooksOpts.hooks, 'beforeRequest');
        spies.afterRequest = sinon.spy(hooksOpts.hooks, 'afterRequest');
        spies.afterEachRequest = sinon.spy(hooksOpts.hooks, 'afterEachRequest');
        spies.beforeEachRequest = sinon.spy(hooksOpts.hooks, 'beforeEachRequest');

        beforeEach(function (done) {
            stubData.token = jwt.sign({
                appId: appId,
                clientId: hooksOpts.saAppId
            }, 'whatever', {});
            done();
        });

        afterEach(function(done){
            spies.beforeRequest.reset();
            spies.afterRequest.reset();
            spies.afterEachRequest.reset();
            spies.beforeEachRequest.reset();
            done();
        });

        _.each([
            {
                functionName: 'v1.app.user.getMap',
                expectedPath: '/v1/apps/' + appId + '/users/map',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {},
                expectedBeforeHooksCalls: 2,
                expectedAfterHooksCalls: 2,
                expectedBeforeEachHooksCalls: 2,
                expectedAfterEachHooksCalls: 2
            },
            {
                functionName: 'v1.app.getStatistics',
                expectedPath: '/v1/apps/' + appId + '/statistics',
                expectedMethod: 'get',
                params: {},
                expectedJson: true,
                expectedQs: {},
                expectedBeforeHooksCalls: 1,
                expectedAfterHooksCalls: 1,
                expectedBeforeEachHooksCalls: 1,
                expectedAfterEachHooksCalls: 1
            },
            {
                functionName: 'v1.app.notify',
                expectedPath: '/v1/apps/' + appId + '/notify',
                expectedMethod: 'post',
                params: {attribute: 'whatever'},
                expectedJson: {attribute: 'whatever'},
                expectedQs: undefined,
                expectedBeforeHooksCalls: 1,
                expectedAfterHooksCalls: 1,
                expectedBeforeEachHooksCalls: 1,
                expectedAfterEachHooksCalls: 1
            }
        ], function (item) {
            it('should make a ' + item.expectedMethod + ' request to ' + item.expectedPath +
                ' when calling ' + item.functionName + ' and execute hooks', function (done) {

                let expectedFunction = getFunctionFromName(kwsApiWithHooks, item.functionName);

                expectedFunction(item.params)
                    .then(function (resp)  {
                        should(resp).eql(stubData.resp.body);
                        should(stubs[item.expectedMethod].callCount).eql(1);
                        should(stubs[item.expectedMethod].lastCall.args[0])
                            .eql(hooksOpts.kwsApiHost + item.expectedPath);
                        should(stubs[item.expectedMethod].lastCall.args[1].json)
                            .eql(item.expectedJson);
                        should(stubs[item.expectedMethod].lastCall.args[1].qs)
                            .eql(item.expectedQs);

                        should(spies.beforeRequest.callCount).eql(1);
                        should(spies.beforeRequest.lastCall.args[0]).eql({
                            method: item.expectedMethod,
                            path: hooksOpts.kwsApiHost + item.expectedPath
                        });

                        should(spies.afterRequest.callCount).eql(1);
                        should(typeof spies.afterRequest.lastCall.args[0]).eql('object');
                        should(typeof spies.afterRequest.lastCall.args[0].requestTime).eql('number');
                        delete spies.afterRequest.lastCall.args[0].requestTime;
                        should(spies.afterRequest.lastCall.args[0]).eql({
                            method: item.expectedMethod,
                            path: hooksOpts.kwsApiHost + item.expectedPath
                        });
                        should(spies.afterRequest.lastCall.args[1]).eql(stubData.resp);
                        should(spies.beforeEachRequest.callCount).eql(item.expectedBeforeEachHooksCalls);
                        if (item.expectedBeforeHooksCalls > 1) {
                            should(spies.beforeEachRequest.firstCall.args[0]).eql({
                                method: 'post',
                                path: hooksOpts.kwsApiHost + '/oauth/token'
                            });
                        }

                        should(spies.beforeEachRequest.lastCall.args[0]).eql({
                            method: item.expectedMethod,
                            path: hooksOpts.kwsApiHost + item.expectedPath
                        });

                        should(spies.afterEachRequest.callCount).eql(item.expectedAfterEachHooksCalls);
                        should(typeof spies.afterEachRequest.lastCall.args[0]).eql('object');
                        should(typeof spies.afterEachRequest.lastCall.args[0].requestTime).eql('number');
                        delete spies.afterEachRequest.lastCall.args[0].requestTime;
                        should(spies.afterEachRequest.lastCall.args[0]).eql({
                            method: item.expectedMethod,
                            path: hooksOpts.kwsApiHost + item.expectedPath
                        });
                        should(spies.afterEachRequest.lastCall.args[1]).eql(stubData.resp);


                        done();
                    });
            });
        });
    });

    describe('overriding endpoints', function () {
        var appId = 1234;
        var userId = 222;
        var customEndpoints = {
            'v1': {
                'user.get': {
                    'alias': null
                },
                'user.update': {
                    'alias': null
                },
                'user.app.list': {
                    'alias': null
                },
                'user.app.create': {
                    'alias': null
                },
                'app.user.list': {
                    'alias': null
                }
            }
        };

        var customOpts = _.extend(kwsSdkOpts, {
            endpoints: customEndpoints
        });
        var customKwsApi = new KwsSdk(customOpts);

        beforeEach(function (done) {
            stubData.token = jwt.sign({
                appId: appId,
                clientId: kwsSdkOpts.saAppId
            }, 'whatever', {});
            done();
        });

        _.each([
            {
                functionName: 'v1.user.get',
                expectedPath: '/v1/users/' + userId,
                expectedMethod: 'get',
                params: {userId: userId},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'v1.user.update',
                expectedPath: '/v1/users/' + userId,
                expectedMethod: 'put',
                params: {userId: userId, firstName: 'whatever'},
                expectedJson: {firstName: 'whatever'},
                expectedQs: undefined
            },
            {
                functionName: 'v1.user.app.list',
                expectedPath: '/v1/users/' + userId + '/apps',
                expectedMethod: 'get',
                params: {userId: userId},
                expectedJson: true,
                expectedQs: {}
            },
            {
                functionName: 'v1.user.app.create',
                expectedPath: '/v1/users/' + userId + '/apps',
                expectedMethod: 'post',
                params: {userId: userId, appId: appId},
                expectedJson: {appId: appId},
                expectedQs: undefined
            },
            {
                functionName: 'v1.app.user.list',
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
                        should(resp).eql(stubData.resp.body);
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
                endpoints: {
                    'v1': {
                        'user.app.create': {
                            'alias': null
                        }
                    }
                }
            });
            var expectedFunction = getFunctionFromName(kwsSdk, 'v1.user.app.create');

            expectedFunction({userId: userId, appId: appId})
                .then(function (resp)  {
                    should(resp).eql(stubData.resp.body);
                    should(stubs.post.callCount).eql(2);
                    should(stubs.post.lastCall.args[0]).eql(kwsSdkOpts.kwsApiHost + '/v1/users/' + userId + '/apps');
                    should(stubs.post.lastCall.args[1].headers['X-KWS-external-ids']).eql(true);
                    done();
                });
        });

        it('should make the second request with the X-KWS-external-ids header set if the first request failed with a 401', function (done) {

            var appId = 1234;
            var userId = 222;
            var kwsSdk = new KwsSdk({
                saAppId: 'test_app',
                saAppApiKey: 'test_key',
                kwsApiHost: 'https://kwsapi.test.superawesome.tv',
                externalUserIds: true,
                endpoints: {
                    'v1': {
                        'user.app.create': {
                            'alias': null
                        }
                    }
                }
            });
            var createUserFunction = getFunctionFromName(kwsSdk, 'v1.user.app.create');

            sandbox.restore();
            sandbox.create();
            stubs.post = sandbox.stub(rp, 'post');
            stubs.post.onCall(0).returns(BPromise.resolve({body: {access_token: stubData.token}}));
            stubs.post.onCall(1).rejects({ statusCode: 401 });
            stubs.post.onCall(2).returns(BPromise.resolve({body: {access_token: stubData.token}}));
            stubs.post.onCall(3).returns(BPromise.resolve(stubData.resp));

            createUserFunction({userId: userId, appId: appId})
                .then(function (resp) {

                    should(resp).eql(stubData.resp.body);
                    should(stubs.post.callCount).eql(4);

                    // Authenticates
                    should(stubs.post.getCall(0).args[0]).eql(kwsSdkOpts.kwsApiHost + '/oauth/token');

                    // Call to API fails
                    should(stubs.post.getCall(1).args[0]).eql(kwsSdkOpts.kwsApiHost + '/v1/users/' + userId + '/apps');
                    should(stubs.post.getCall(1).args[1].headers['X-KWS-external-ids']).eql(true);

                    // Re-authenticates
                    should(stubs.post.getCall(2).args[0]).eql(kwsSdkOpts.kwsApiHost + '/oauth/token');

                    // Retries calling API
                    should(stubs.post.getCall(3).args[0]).eql(kwsSdkOpts.kwsApiHost + '/v1/users/' + userId + '/apps');
                    should(stubs.post.getCall(3).args[1].headers['X-KWS-external-ids']).eql(true);

                    done();
                });
        });

        it('should only make the request once if the first request fails with a non-401 error', function (done) {

            var appId = 1234;
            var userId = 222;
            var kwsSdk = new KwsSdk({
                saAppId: 'test_app',
                saAppApiKey: 'test_key',
                kwsApiHost: 'https://kwsapi.test.superawesome.tv',
                externalUserIds: true,
                endpoints: {
                    'v1': {
                        'user.app.create': {
                            'alias': null
                        }
                    }
                }
            });
            var createUserFunction = getFunctionFromName(kwsSdk, 'v1.user.app.create');

            sandbox.restore();
            sandbox.create();
            stubs.post = sandbox.stub(rp, 'post');
            stubs.post.onCall(0).returns(BPromise.resolve({body: {access_token: stubData.token}}));
            stubs.post.onCall(1).rejects({ statusCode: 400, message: 'validation error' });

            createUserFunction({userId: userId, appId: appId})
                .then(function (resp) {
                    done('Unexpected');
                })
                .catch(function(err) {
                    should(err.statusCode).eql(400);
                    should(err.message).eql('validation error');

                    should(stubs.post.callCount).eql(2);

                    // Authenticates
                    should(stubs.post.getCall(0).args[0]).eql(kwsSdkOpts.kwsApiHost + '/oauth/token');

                    // Call to API fails
                    should(stubs.post.getCall(1).args[0]).eql(kwsSdkOpts.kwsApiHost + '/v1/users/' + userId + '/apps');
                    should(stubs.post.getCall(1).args[1].headers['X-KWS-external-ids']).eql(true);
                    done();
                })
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
        });
    });

});
