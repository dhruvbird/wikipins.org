var http    = require('http');
var express = require('express');
var fs      = require("fs");
var ejs     = require('ejs');
var path    = require('path');
var _       = require('underscore');
var crypto  = require('crypto');
var app     = express();
var ds      = require("./datastore.js");

var spiderUARE = /facebookexternalhit|quora/i;
var i404 = [ ];
var i404_idx = 0;

function md5hex(s) {
    var md5 = crypto.createHash('md5');
    md5.update(s, 'utf8');
    return md5.digest('hex');
}

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

_.mixin({
    zipToObject: function(keys) {
        var arrays = Array.prototype.slice.call(arguments, 1);
        var ret = [ ];
        if (arrays.length < 1) {
            return [ ];
        }
        var i, j;
        for (i = 0; i < arrays[0].length; ++i) {
            var o = { };
            for (j = 0; j < keys.length; ++j) {
                o[keys[j]] = arrays[j][i];
            }
            ret.push(o);
        }
        return ret;
    }
});

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

    console.error("[%s] Starting the wikipins.org serving engine on port '%s' & db '%s'",
                  String(new Date()), String(opts.port), String(opts.db));

    var dir_404 = path.dirname(require.resolve("./static/404/404.html"));
    i404 = fs.readdirSync(dir_404).filter(function(iname) {
        return iname.search(/\.jpg$/i) != -1;
    });

    var template_404 = ejs.compile(fs.readFileSync(require.resolve("./static/404/404.html"), 'utf8'));
    var template_index = ejs.compile(fs.readFileSync(require.resolve("./static/index.html"), 'utf8'));
    var template_spider_index = ejs.compile(fs.readFileSync(require.resolve("./static/spider_index.html"), 'utf8'));

    app.use(function(req, res, next) {
        var ua = req.headers['user-agent'] ? req.headers['user-agent'] : '';
        console.log("%s - [%s] - %s - %s - %s", req.ip, String(new Date()), req.method, req.url, ua);
        next();
    });

    app.use('/static/', express.static(__dirname + "/static/"));

    app.set("jsonp callback", true);

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
        var category = unescape(req.query.category || '').trim();
        if (!category) {
            res.jsonp([ ]);
            return;
        }
        ds.get_category_abstracts(category, function(abstracts) {
            res.jsonp(abstracts);
        });
    });

    // Fetch the abstract for a sprcific article given its title.
    //
    // /article_abstract/?title=ARTICLE_TITLE
    app.get("/article_abstract[/]?", function(req, res) {
        var title = unescape(req.query.title || '').trim();
        if (!title) {
            res.jsonp([ ]);
            return;
        }
        ds.get_multi_abstracts_by_title(title, function(abstracts) {
            res.jsonp(abstracts);
        });
    });

    // Fetch related categories for a given category name
    //
    // /related_categories/?category=CATEGORY_NAME
    app.get("/related_categories[/]?", function(req, res) {
        var category = unescape(req.query.category || '').trim();
        var title    = unescape(req.query.title || '').trim();

        if (category) {
            ds.get_related_categories(category, function(related_categories) {
                res.jsonp(related_categories);
            });
        } else if (title) {
            ds.get_related_categories_images(title, function(related_categories) {
                res.jsonp(related_categories);
            });
        } else {
            // FIXME - 404
            res.jsonp([ ]);
        }
    });

    app.get("/", function(req, res) {
        var ua = req.headers['user-agent'] || '';
        if (ua.search(spiderUARE) == -1) {
            res.send(template_index({
                title: "Wikipins.org"
            }));
        } else {
            // Generate an ugly static page.
            ds.get_random_category_images(function(category_images) {
                res.send(template_spider_index({
                    title: "Wikipins.org",
                    articles: [ ],
                    categories: category_images,
                    _: _,
                md5hex: md5hex
                }));
            });
        }
    });

    app.get("/favicon.gif", function(req, res) {
        res.setHeader('Content-Type', 'image/gif');
        res.send(fs.readFileSync("./favicon.gif"));
    });

    app.get("/[ac]/([^/]+)[/]?", function(req, res) {
        var urlRE = new RegExp("^/[ac]/([^/]+)[/]?$");
        var catReq = req.url.search(/^\/c\//) === 0;
        var title = unescape(req.url.match(urlRE)[1].replace(/_/g, ' '));
        var proc = 'get_multi_abstracts_by_title';
        var ua = req.headers['user-agent'] || '';

        if (catReq) {
            proc = 'get_category_abstracts';
        }

        if (ua.search(spiderUARE) == -1) {
            res.send(template_index({
                title: title + " - Wikipins.org"
            }));
        } else {
            ds[proc](title, function(abstracts) {
                res.send(template_spider_index({
                    title: title + " - Wikipins.org",
                    articles: abstracts,
                    categories: [ ],
                    _: _,
                    md5hex: md5hex
                }));
            });
        }
    });

    app.get('*', function(req, res) {
        res.send(template_404({
            image_name: i404[i404_idx],
            url: req.url
        }));
        i404_idx = (i404_idx + 1) % i404.length;
    });

    ds.set_db_name(opts.db);
    app.listen(opts.port);
}

main();
