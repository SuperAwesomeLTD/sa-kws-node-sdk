'use strict';

var atob = require('atob');
var decamelize = require('decamelize');

function parseTokenData(token) {
    var tokenData;

    try {
        tokenData = token.split('.');
        tokenData = JSON.parse(atob(tokenData[1]));
    } catch (err) {
        tokenData = null;
    }

    return tokenData;
}

function tokenActive(token) {
    var result = false;

    try {
        var tokenData = parseTokenData(token);
        var expiryTime = tokenData.exp * 1000;

        if (new Date().getTime() < expiryTime) {
            result = true;
        } else {
            result = false;
        }
    } catch (e) {
        result = false;
    }

    return result;    
}

function isActionCustom(action) {
    switch (action) {
    case 'get':
    case 'list':
    case 'create':
    case 'update':
    case 'delete':
        return false;
    default:
        return true;
    }
}

function getMethodFromAction(action) {
    switch (action) {
    case 'get':
    case 'list':
        return 'get';
    case 'create':
        return 'post';
    case 'update':
        return 'put';
    case 'delete':
        return 'delete';
    }

    // If it gets here, is a custom action (either get or post)
    if (action.substring(0, 3) === 'get' && action.charAt(3).toLowerCase() !== action.charAt(3)) {
        return 'get';
    }
    return 'post';
}

function getUrlFromAction(action) {
    var result;
    // Check if the action is a custom get, and in that case translate to url (remove the get part)
    if (!isActionCustom(action)) {
        result = '';
    } else if (action.substring(0, 3) === 'get' && action.charAt(3).toLowerCase() !== action.charAt(3)) {
        result = action.charAt(3).toLowerCase() + action.substring(4);
    } else {
        result = action;
    }

    return decamelize(result, '-');
}

function createPathFromEndpoint(endpoint, params, token) {
    var path = '/v1';
    var parts = endpoint.split('.');
    var tokenData = parseTokenData(token) || {};
    var action = parts[parts.length - 1];

    params = params || {};

    for (var i = 0; i < parts.length - 1; i++) {
        path += '/' + decamelize(parts[i], '-') + 's';

        // Add id to the path if existing in params or tokenData
        if ((i < parts.length - 2) || (action !== 'list' && action !== 'create')) {
            var id = parts[i] + 'Id';
            if (params[id]) {
                path += '/' + params[id];
                // This attribute should not be used later in the body or query. We remove it
                delete params[id];
            } else if (tokenData[id]) {
                path += '/' + tokenData[id];
            }            
        }
    }

    // Add url action if exists
    var actionUrl = getUrlFromAction(action);
    path += actionUrl ? ('/' + actionUrl) : '';

    return path;
}

module.exports = {
    parseTokenData: parseTokenData,
    tokenActive: tokenActive,
    isActionCustom: isActionCustom,
    getMethodFromAction: getMethodFromAction,
    getUrlFromAction: getUrlFromAction,
    createPathFromEndpoint: createPathFromEndpoint
};