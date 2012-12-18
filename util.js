"use strict";

var fs      = require('fs');
var qs      = require('querystring');
var jsdom   = require('jsdom');
var request = require('request');
var jquery  = fs.readFileSync(require.resolve("./jquery.min.js"), 'utf-8');

function loadDOM(html, cb) {
    try {
        jsdom.env({
            html: html, 
            src: [
                jquery
            ],
            done: function(errors, window) {
                cb(window.$, window, errors);
            }
        });
    } catch(ex) { console.error("loadDOM::ex:", ex); }
}

function getURL(url, cb) {
    request(url, function(error, response, body) {
        // console.log(body);
        if (!error && response.statusCode === 200) {
            cb(body);
        } else {
            cb(null, error);
        }
    });
}

exports.loadDOM     = loadDOM;
exports.getURL      = getURL;
