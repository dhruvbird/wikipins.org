var http    = require('http');
var express = require('express');
var fs      = require("fs");
var app     = express();
var ds      = require("./datastore.js");

app.set("jsonp callback", true);

// /random_categories/
app.get("/random_categories[/]?", function(req, res) {
    ds.get_random_category_images(function(category_images) {
        res.jsonp(category_images);
    });
});

// /suggest_categories/?category=PREFIX
app.get("/suggest_categories[/]?", function(req, res) {
    var category = unescape(req.query.category);
    if (!category) {
        res.send("[]");
        return;
    }
    ds.suggest_categories(category, 10, function(suggested_categories) {
        res.jsonp(suggested_categories);
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
    ds.get_category_titles(category, function(titles) {
        ds.get_multi_abstracts_by_title(titles, function(abstracts) {
            res.jsonp(abstracts);
        });
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

function serve_static_file(req, res, file_path) {
    var index_path = require.resolve(file_path);
    var index_fd = fs.openSync(index_path, 'r');
    var index_stream = fs.createReadStream(index_path, {
        fd: index_fd,
        encoding: 'utf8'
    });
    index_stream.pipe(res);
}

app.get("/", function(req, res) {
    serve_static_file(req, res, "./index.html");
});

app.get("/md5.js", function(req, res) {
    serve_static_file(req, res, "./md5.js");
});

app.get("/c/[^/]+[/]?", function(req, res) {
    var category = req.params.category;
    serve_static_file(req, res, "./index.html");
});

app.listen(8080);
