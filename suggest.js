var http    = require('http');
var express = require('express');
var app     = express();
var request = require('request');
var _       = require('underscore');
var qs      = require('querystring');

var acendpoint = '';

function make_ac_request(url, params, cb) {
    url += "?" + qs.stringify(params);
    // console.log("url", url);
    request.get(url, function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.error(error);
            cb([ ]);
        }
        var jbody = [ ];
        try { jbody = JSON.parse(body); } catch(ex) { console.error(ex); }
        // console.log(jbody);
        jbody = jbody.map(function(entry) {
            entry.phrase = entry.phrase.substr(2);
            return entry;
        });
        cb(jbody);
    });
}
   

function main() {
    var opts = require('tav').set({
        'acendpoint': {
            note: 'The HTTP endpoint of the cpp-libface autocomplete server (default: localhost:6767)',
            value: 'localhost:6767'
        },
        'port': {
            note: 'The port on which to listen for connections (default: 80)',
            value: 80
        }
    }, 'Autocomplete wrapper for lib-face and wikipins');

    acendpoint = "http://" + opts.acendpoint + "/face/suggest/";
    app.set("jsonp callback", true);

    //
    // Suggest completions for a given prefix.
    //
    // result set format:
    // { "categories": [ { "phrase": ..., "score": ... }, ... ],
    //   "articles"  : [ { "phrase": ..., "score": ... }, ... ]
    // }
    //
    // /suggest/?q=PREFIX&n=LIMIT
    //
    app.get("/suggest[/]?", function(req, res) {
        var q = unescape(req.query.q || '');
        var n = unescape(req.query.n || 16);
        // console.log("q", q, "n", n);
        var ares = [ ];
        var cres = [ ];
        var nresponses = 0;

        function response_cb() {
            res.jsonp({
                articles:   ares,
                categories: cres
            });
        }

        make_ac_request(acendpoint, { q: "a:" + q, n: n }, function(jres) {
            ares = jres;
            if (++nresponses == 2) response_cb();
        });

        make_ac_request(acendpoint, { q: "c:" + q, n: n }, function(jres) {
            cres = jres;
            if (++nresponses == 2) response_cb();
        });
    });

    app.listen(opts.port);
}

main();
