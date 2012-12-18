var util = require('./util.js');
var _    = require('underscore');

var LANG = 'en';
var URL_TEMPLATE = '.wikipedia.org/wiki/Main_Page';
var URL = 'http://' + LANG + URL_TEMPLATE;

function is_interesting_link(title, url) {
    if (title.search(/^(Wikipedia:|mail:)/) == 0) {
        return false;
    }
    if (url.search(/^\/wiki\//) != 0) {
        return false;
    }
    return true;
}

function multi_get_urls(urls, cb) {
    var ret = [ ];
    for (var i = 0; i < urls.length; ++i) {
        (function() {
            var url = urls[i];
            util.getURL(url, function(body, err) {
                console.error("Got result for url:", url);
                ret.push({
                    url: url,
                    body: body
                });
                if (ret.length == urls.length) {
                    cb(ret);
                }
            });
        })();
    }
}

function get_main_page_titles(cb) {
    util.getURL(URL, function(body, err) {
        if (err) {
            console.error(err);
            return;
        }

        console.log("GOT PAGE");

        util.loadDOM(body, function($, window, errors) {
            var main_page_links = $("td.MainPageBG b a").filter(function(i, x) {
                var title = $(x).attr('title');
                var href  = $(x).attr('href');
                return is_interesting_link(title, href);
            }).toArray();
            var main_page_titles = main_page_links.map(function(link) {
                return {
                    href:  $(link).attr('href'),
                    text:  $(link).text(),
                    title: $(link).attr('title')
                };
            });
            main_page_titles = _.uniq(main_page_titles, false, function(link) {
                return link.href;
            });
            main_page_titles = main_page_titles.map(function(title) {
                title['abstract'] = "Lorem Ipsum...";
                return title;
            });
            console.log(main_page_titles);
            cb(main_page_titles);
        });
    });
}

function print_content(content) {
    content.forEach(function(c) {
        console.log("url:", c.url,
                    "body length:", (c.body ? c.body.length : 0));
    });
}

function parse_content(content) {
    content = content.filter(function(c) {
        return !!c.body;
    });

    console.error("content.length:", content.length);

    function parse_wiki_html(body, cb) {
        /// console.log("body:", body.substr(0, 128));
        util.loadDOM(body, function($, window, errors) {
            var _abstract = $("#mw-content-text p").first().text();
            var _image    = $("table.infobox img").attr('src');
            if (!_image) {
                _image = $("div.thumb:first img:first").attr('src');
            }
            cb({
                "abstract": _abstract,
                "image":    _image
            });
        });
    }

    content.forEach(function(c) {
        parse_wiki_html(c.body, function(meta) {
            console.log(meta);
        });
    });
}

function main() {
    get_main_page_titles(function(main_page_titles) {
        var main_mage_urls = main_page_titles.map(function(title) {
            return "http://en.wikipedia.org" + title.href;
        }).slice(0, 10);
        // multi_get_urls(main_mage_urls, print_content);
        multi_get_urls(main_mage_urls, parse_content);
    });
}

main();
setInterval(function(){}, 1000);
