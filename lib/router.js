var express = require('express');
var rp = require('request-promise');
var cookieParser = require('cookie-parser');
var url = require('url');

function createRouter(sdkOptions) {
    var router = express.Router();
    router.use(cookieParser());

    router.get('/sa/authentication/logout', function(req, res) {
        res.clearCookie('sa.kws.user.token');
        res.clearCookie('sa.kws.app.token');
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
                    'sa.kws.user.token',
                    resp.access_token,
                    cookie
                );

                res.redirect(sdkOptions.loginRedirectUrl || '/');
            })
            .catch(function (resp) {
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
            userToken: allowed ? req.cookies['sa.kws.user.token'] : undefined,
            appToken: allowed ? req.cookies['sa.kws.app.token'] : undefined
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
                    'sa.kws.app.token',
                    resp.access_token,
                    cookie
                );

                return res.status(200).json(resp);
            })
            .catch(function () {
                return res.status(400).json({message:'Authentication failed'});
            });
    });

    return router;
}

module.exports = {
    createRouter: createRouter
};
