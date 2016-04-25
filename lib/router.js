var express = require('express');
var rp = require('request-promise');
var cookieParser = require('cookie-parser');
var url = require('url');
var UserSdk = require('./userSdk');

function createRouter(sdkOptions) {

    var cookieNameUser = sdkOptions.cookieNameUser || 'sa.kws.user.token';
    var cookieNameApp = sdkOptions.cookieNameApp || 'sa.kws.app.token';
    var headerNameUser = sdkOptions.headerNameUser || 'sa-kws-user-token';
    var headerNameApp = sdkOptions.headerNameApp || 'sa-kws-app-token';

    var router = express.Router();
    router.use(cookieParser());

    router.get('/sa/authentication/logout', function(req, res) {
        res.clearCookie(cookieNameUser);
        res.clearCookie(cookieNameApp);
        res.redirect(sdkOptions.logoutRedirectUrl || '/');
    });

    // Endpoint for the new KWS API
    router.get('/sa/oauth/callback', function(req, res) {
        var tokenPath = sdkOptions.kwsApiHost + '/oauth/token';
        var code = req.query.code;

        var opts = {
            auth: {
                user: sdkOptions.clientId,
                pass: sdkOptions.apiKey
            },
            form: {
                grant_type: 'authorization_code',
                code: code,
                redirectUri: req.url
            },
            json: true
        };

        return rp.post(tokenPath, opts)
            .then(function (resp) {
                var cookie = {
                    maxAge: 60 * 60 * 24 * 1000, // 1 day
                    httpOnly: false
                };

                res.cookie(
                    cookieNameUser,
                    resp.access_token,
                    cookie
                );

                res.redirect(sdkOptions.loginRedirectUrl || '/');
            })
            .catch(function (resp) {
                if (sdkOptions.debug) {
                    sdkOptions.logger('Error in: /sa/oauth/callback');
                    sdkOptions.logger(resp);
                }
                res.redirect(sdkOptions.logoutRedirectUrl || '/');
            });
    });

    // Endpoint to exchange cookie for token
    router.get('/sa/oauth/token', function(req, res) {
        var urlData = url.parse(req.headers.referer, true);

        var escapeRegExp = function(str) {
            return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        }

        // check if the request comes from a trusted domain
        var allowed = false;
        for(var i = 0; i < sdkOptions.allowedDomains.length; ++i) {
            var host = urlData.hostname;
            if (host.match(new RegExp(escapeRegExp(sdkOptions.allowedDomains[i]) + '$'))) {
                allowed = true;
                break;
            }
        }

        res.status(allowed ? 200 : 403).jsonp({
            userToken: allowed ? req.cookies[cookieNameUser] : undefined,
            appToken: allowed ? req.cookies[cookieNameApp] : undefined
        });
    });

    // Endpoint to authenticate the frontend SDK as an app
    router.post('/sa/authentication/frontend-app-token', function(req, res) {

        var tokenPath = sdkOptions.kwsApiHost + '/oauth/token';

        var opts = {
            auth: {
                user: sdkOptions.clientId,
                pass: sdkOptions.apiKey
            },
            form: {
                grant_type: 'client_credentials',
                scope: 'frontend'
            },
            json: true
        };

        return rp.post(tokenPath, opts)
            .then(function (resp) {
                var cookie = {
                    maxAge: 60 * 60 * 24 * 1000, // 1 day
                    httpOnly: false
                };

                res.cookie(
                    cookieNameApp,
                    resp.access_token,
                    cookie
                );

                return res.status(200).json(resp);
            })
            .catch(function (resp) {
                if (sdkOptions.debug) {
                    sdkOptions.logger('Error in: /sa/authentication/frontend-app-token');
                    sdkOptions.logger(resp);
                }
                
                return res.status(400).json({message:'Authentication failed'});
            });
    });

    router.use(function(req, res, next) {
        req.saUserSdk = new UserSdk({
            kwsApiHost: sdkOptions.kwsApiHost,
            userToken: req.headers[headerNameUser] || req.cookies[cookieNameUser],
            appToken: req.headers[headerNameApp] || req.cookies[cookieNameApp]
        });
        next();
    });

    return router;
}

module.exports = {
    createRouter: createRouter
};
