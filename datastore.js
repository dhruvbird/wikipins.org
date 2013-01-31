var mysql  = require('mysql');
var _      = require('underscore');
var config = require('./config.js');
var LRU    = require("lru-cache")

var imageFileRE = /[^\|]+\.(jpg|jpeg|bmp|png|gif|yuv|svg|tiff|jps)/i;
var redundantPrefixRE = /^(Image|File):/i;
var hexRE = /%[A-Z0-9]{2}/;

var db_name = 'wikipins';

var recently_viewed_articles = LRU({ max: 250 });

function clean_image_name(name) {
    if (name.search(hexRE) != -1) {
        return new Buffer(unescape(name), 'binary').toString('utf8');
    }
    return name;
}

function get_conn() {
    var db_config = config.db;
    db_config.database = db_name;
    var connection = mysql.createConnection(db_config);
    return connection;
}

function get_recently_viewed_articles(cb) {
    cb(recently_viewed_articles.values());
}

var get_random_category_images = (function(n, delay) {
    var cached = { };
    var prev_ts = new Date() - delay - 1000;
    return function(cb) {
        cb = _.once(cb);
        if (new Date() - prev_ts < delay) {
            cb(cached);
            return;
        }

        if (Object.keys(cached).length > 0) {
            // Return cached data, but perform computation.
            cb(cached);
        }
        /* Get # of elements in the category_list table.
         *
         * SELECT COUNT(*) AS count FROM category_list
         */

        /* Get the 'n' random categories
         *
         * SELECT CL.category FROM category_list CL WHERE CL.id IN ?
         */
        var connection = get_conn();
        connection.query('SELECT COUNT(*) AS count FROM category_list', function(err, rows, fields) {
            if (err) {
                console.error(err.stack);
                cb([ ]);
                return;
            }
            var row_count = rows[0].count;
            var rids = [ -10, -20 ]; // FIXME
            var i;
            for (i = 0; i < n; ++i) {
                rids.push(Math.floor(Math.random() * row_count));
            }

            get_multi_category_id_images_and_count(rids, function(data) {
                prev_ts = new Date();
                cached = data;
                cb(data);
            });

        });
        connection.end();
    };
})(128, 30 * 1000); // Cache for 30 second.

function concat_recently_viewed(rows, limit, cb) {
    get_recently_viewed_articles(function(rva) {
        rva.slice(0, limit).forEach(function(entry) {
            entry.category = 'Recently Viewed';
            // Don't delete the abstract key since another API call will use it.
            entry.count = rva.length;
        });
        rows = rows.concat(rva);
        var res = _.groupBy(rows, 'category');
        cb(res);
    });
}

// Returns a set of up to 8 images for the list of category IDs passed
// in.
function get_multi_category_id_images_and_count(category_ids, cb) {
    var connection = get_conn();

    connection.query("SELECT CI.category AS category, COALESCE(I.image_name, CI.image) AS image, CL.count AS count, CI.title AS title " +
                     "FROM category_list CL INNER JOIN category_images CI " +
                     "ON CL.category = CI.category " +
                     "LEFT OUTER JOIN images I " +
                     "ON I.image_name = REPLACE(CI.image, '_', ' ') " +
                     "WHERE CL.id IN (?) ",
                     [ category_ids ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         if (category_ids.indexOf(-20) != -1) {
                             // Exists
                             concat_recently_viewed(rows, 8, cb);
                         } else {
                             var res = _.groupBy(rows, 'category');
                             cb(res);
                         }
                     });
    connection.end();
}

//
// Returns a set of up to 8 images for the list of categories passed
// in. The '8' is hard-coded in the data (database) itself (i.e. There
// are only up to 8 rows for a given category name in the table
// category_images).
//
function get_multi_category_images_and_count(categories, cb) {
    var connection = get_conn();

    connection.query("SELECT CI.category AS category, I.image_name AS image, CL.count AS count, CI.title AS title " +
                     "FROM category_list CL, category_images CI, images I " +
                     "WHERE CL.category = CI.category AND " +
                     "I.image_name = CI.image AND " +
                     "CI.category IN (?) ",
                     [ category ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         if (category.indexOf('Recently Viewed') != -1) {
                             // Exists
                             concat_recently_viewed(rows, 8, cb);
                         } else {
                             var res = _.groupBy(rows, 'category');
                             cb(res);
                         }
                     });
    connection.end();
}

// Given a list of titles, return a list of related categories along
// with their relative weights w.r.t. the titles passed in.
//
// Returns an array with each element being a hash of the following form:
// { category: CATEGORY_NAME, count: NUMBER_OF_TIME_THIS_CATEGORY_OCCURS }
//
// INFO: Unused
//
function get_multi_categories_by_titles(titles, cb) {
    /* SELECT category, COUNT(*) as count FROM categories
       WHERE title IN ? GROUP BY category
    */
    if (titles.length === 0) {
        cb([]);
        return;
    }
    var connection = get_conn();
    connection.query("SELECT category, COUNT(*) as count FROM categories " +
                     "WHERE title IN (?) GROUP BY category",
                     [ titles ], function(err, rows, fields) {
                         cb(rows);
                     });
    connection.end();
}

/* Given a category name, return a list of related category names */
function get_related_categories(category, cb) {
    var connection = get_conn();
    connection.query("SELECT TC.category AS category, COUNT(*) as count " +
                     "FROM categories TC JOIN categories C " +
                     "ON C.title=TC.title " +
                     "WHERE C.category = ? " +
                     "GROUP BY category ORDER BY count DESC", [ category ], function(err, rows, fields) {
                         cb(rows);
                     });
    connection.end();
}

/* Get the list of up to 256 titles for a given category name */
//
// INFO: Unused
function get_category_titles(category, cb) {
    /* SELECT title FROM categories WHERE category = ? LIMIT 256 */
    var connection = get_conn();
    connection.query("SELECT title FROM categories WHERE category = ? LIMIT 256",
                     [ category ], function(err, rows, fields) {
                         var categories = _.pluck(rows, 'title');
                         cb(categories);
                     });
    connection.end();
}

function get_multi_abstracts_by_title_redirect(titles, cb) {
    /* SELECT A.title AS title , A.abstract AS abstract, A.image AS image
       FROM abstracts A, 
       (SELECT totitle FROM redirects WHERE fromtitle IN ?) R 
       WHERE R.totitle = A.title;
    */
    if (titles.length === 0) {
        cb([]);
        return;
    }
    var connection = get_conn();
    connection.query("SELECT A.title AS title , A.abstract AS abstract, COALESCE(I.image_name, A.image) AS image " +
                     "FROM abstracts A LEFT OUTER JOIN images I " +
                     "ON REPLACE(A.image, '_', ' ') = I.image_name " +
                     "INNER JOIN redirects R " +
                     "ON R.totitle COLLATE utf8_unicode_ci = A.title " +
                     "WHERE R.fromtitle IN (?)",
                     [ titles ], function(err, rows, fields) {
                         if (err) {
                             console.error(err.stack);
                             cb([]);
                             return;
                         }
                         rows = rows.map(function(row) {
                             row.image = clean_image_name(row.image);
                             return row;
                         });
                         cb(rows);
                     });
    connection.end();
}

function get_multi_abstracts_by_title_noredirect(titles, cb) {
    /* SELECT A.title AS title , A.abstract AS abstract, A.image AS image
       FROM abstracts A WHERE A.title IN ?;
    */
    if (titles.length === 0) {
        cb([]);
        return;
    }
    var connection = get_conn();
    connection.query("SELECT A.title AS title, A.abstract AS abstract, COALESCE(I.image_name, A.image) AS image " +
                     "FROM abstracts A LEFT OUTER JOIN images I " +
                     "ON I.image_name = REPLACE(A.image, '_', ' ') " +
                     "WHERE A.title IN (?)",
                     [ titles ], function(err, rows, fields) {
                         if (err) {
                             console.error(err.stack);
                             cb([]);
                             return;
                         }
                         rows = rows.map(function(row) {
                             row.image = clean_image_name(row.image);
                             return row;
                         });
                         cb(rows);
                     });
    connection.end();
}

function uniquify_by_key(key, a1, a2) {
    var i, j, h = { };
    var res = [ ];
    for (i = 1; i < arguments.length; ++i) {
        for (j = 0; j < arguments[i].length; ++j) {
            var obj = arguments[i][j];
            if (obj[key] && !h.hasOwnProperty(obj[key])) {
                h[obj[key]] = 1;
                res.push(obj);
            }
        }
    }
    return res;
}

function get_multi_abstracts_by_title(titles, cb) {
    get_multi_abstracts_by_title_noredirect(titles, function(res1) {
        get_multi_abstracts_by_title_redirect(titles, function(res2) {
            // console.log(res1, res2);
            var u = uniquify_by_key('title', res1, res2);
            if (u.length < 5) {
                u.forEach(function(entry) {
                    recently_viewed_articles.set(entry.title, entry);
                });
            }
            cb(u);
        });
    });
}

// Fetch up to 256 abstracts for a given category.
//
// FIXME: Join with the images table
function get_category_abstracts(category, cb) {
    if (category.toLowerCase() == 'recently viewed') {
        get_recently_viewed_articles(cb);
        return;
    }

    var connection = get_conn();
    connection.query("SELECT A.title AS title, A.abstract AS abstract, A.image AS image " +
                     "FROM categories C INNER JOIN abstracts A " +
                     "ON A.title=C.title COLLATE utf8_unicode_ci " +
                     "WHERE C.category = ? LIMIT 256",
                     [ category ], function(err, rows, fields) {
                         if (err) {
                             console.error(err.stack);
                             cb([]);
                             return;
                         }
                         rows = rows.map(function(row) {
                             // FIXME: Move this into wikidump2tsv.js
                             row.image = clean_image_name(row.image);
                             return row;
                         });
                         cb(rows);
                     });
    connection.end();
}

function get_final_title(title, connection, cb) {
    connection.query("SELECT totitle FROM redirects WHERE fromtitle = ? LIMIT 1",
                     [ title ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(title);
                             return;
                         }
                         if (rows.length == 0) {
                             cb(title);
                             return;
                         }
                         cb(rows[0].totitle);
                     });
}

function get_related_categories_images(title, cb) {
    var connection = get_conn();

    get_final_title(title, connection, function(final_title) {
        connection.query("SELECT CI.category AS category, COALESCE(I.image_name, CI.image) AS image, CL.count AS count, CI.title AS title " +
                         "FROM categories C INNER JOIN category_images CI " +
                         "ON CI.category=C.category COLLATE utf8_unicode_ci " +
                         "INNER JOIN category_list CL " +
                         "ON CL.category=C.category COLLATE utf8_unicode_ci " +
                         "LEFT OUTER JOIN images I " +
                         "ON REPLACE(CI.image, '_', ' ') = I.image_name " +
                         "WHERE C.title=?",
                         [ final_title ], function(err, rows, fields) {
                             if (err) {
                                 console.error(err);
                                 cb([]);
                                 return;
                             }
                             var res = _.groupBy(rows, 'category');
                             cb(res);
                         });
        connection.end();
    });
}

function set_db_name(dbname) {
    db_name = dbname;
}

function test(which) {
    if (which.get_multi_abstracts_by_title) {
        get_multi_abstracts_by_title(which.get_multi_abstracts_by_title, function(abstracts) {
            console.log("get_multi_abstracts_by_title(", which.get_multi_abstracts_by_title, ") = ", abstracts);
        });
    }

    if (which.get_category_titles) {
        get_category_titles(which.get_category_titles, function(titles) {
            console.log("get_category_titles(", which.get_category_titles, ") = ", titles);
            get_multi_abstracts_by_title(titles, function(abstracts) {
                console.log("get_multi_abstracts_by_title(", titles, ") = ", abstracts);
            });
        });
    }

    if (which.get_multi_category_images) {
        get_multi_category_images(which.get_multi_category_images, function(images) {
            console.log("get_multi_category_images(", which.get_multi_category_images, ") = ", images);
        });
    }

    if (which.get_multi_categories_by_titles) {
        get_multi_categories_by_titles(which.get_multi_categories_by_titles, function(categories) {
            console.log("get_multi_categories_by_titles(", which.get_multi_categories_by_titles, ") = ", categories);
        });
    }

    if (which.get_random_category_images) {
        get_random_category_images(function(rci) {
            console.log("get_random_category_images() = ", rci);
        });
    }

    if (which.get_related_categories) {
        get_related_categories(which.get_related_categories, function(rcat) {
            console.log("get_related_categories(", which.get_related_categories, ") = ", rcat);
        });
    }
}

if (require.main === module) {
    test({
        // get_multi_abstracts_by_title:        [ "Barack Obama", "Adolf Hitler", "Water" ],
        // get_category_titles:                 '13th-century deaths',
        // get_multi_category_images_and_count: ['13th-century deaths', '12th-century deaths'],
        // get_multi_categories_by_titles:      [ "Barack Obama", "George H. W. Bush", "Democrats", "Republicans", "Adolf Hitler", "Water" ]
        get_random_category_images:          true,
        get_related_categories:                 '13th-century deaths'
    });
}

exports.get_related_categories              = get_related_categories;
exports.get_multi_abstracts_by_title        = get_multi_abstracts_by_title;
exports.get_category_titles                 = get_category_titles;
exports.get_multi_category_images_and_count = get_multi_category_images_and_count;
exports.get_multi_categories_by_titles      = get_multi_categories_by_titles;
exports.get_random_category_images          = get_random_category_images;
exports.set_db_name                         = set_db_name;
exports.get_category_abstracts              = get_category_abstracts;
exports.get_related_categories_images       = get_related_categories_images;
