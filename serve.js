var http    = require('http');
var express = require('express');
var fs      = require("fs");
var app     = express();
var ds      = require("./datastore.js");

function serve_static_file(req, res, file_path, encoding) {
    encoding = encoding || 'utf8';
    var index_path = require.resolve(file_path);
    var index_fd = fs.openSync(index_path, 'r');
    var index_stream = fs.createReadStream(index_path, {
        fd: index_fd,
        encoding: encoding
    });
    index_stream.pipe(res);
}

function main() {
    var opts = require('tav').set({
        'db': {
            note: 'The database name to use for querying (default: wikipins)',
            value: 'wikipins'
        },
        'port': {
            note: 'The port on which to listen for connections (default: 80)',
            value: 80
        }
    }, 'Serve the wikipins.org site');

    app.set("jsonp callback", true);

    app.use(function(req, res, next) {
        console.log("%s - [%s] - %s - %s", req.ip, String(new Date()), req.method, req.url);
        next();
    });

    // /random_categories/
    app.get("/random_categories[/]?", function(req, res) {
        ds.get_random_category_images(function(category_images) {
            res.jsonp(category_images);
        });
    });

    // Fetch the list of titles & abstracts for a given category name.
    //
    // /category_abstracts/?category=CATEGORY_NAME
    app.get("/category_abstracts[/]?", function(req, res) {
        var category = unescape(req.query.category);
        if (!category) {
            res.send("[]");
            return;
        }
        ds.get_category_abstracts(category, function(abstracts) {
            res.jsonp(abstracts);
        });
    });
    
    // Fetch related categories for a given category name
    //
    // /related_categories/?category=CATEGORY_NAME
    app.get("/related_categories[/]?", function(req, res) {
        var category = unescape(req.query.category);
        if (!category) {
            res.send("[]");
        return;
        }
        ds.get_related_categories(category, function(related_categories) {
            res.jsonp(abstracts);
        });
    });
    
    app.use('/static/', express.static(__dirname + "/static/"));

    app.get("/", function(req, res) {
        serve_static_file(req, res, "./static/index.html");
    });

    app.get("/favicon.gif", function(req, res) {
        res.setHeader('Content-Type', 'image/gif');
        res.send(fs.readFileSync("./favicon.gif"));
    });

    app.get("/c/[^/]+[/]?", function(req, res) {
        serve_static_file(req, res, "./static/index.html");
    });

    ds.set_db_name(opts.db);
    app.listen(opts.port);
}

main();
