var mysql = require('mysql');
var _     = require('underscore');

var imageFileRE = /[^\|]+\.(jpg|jpeg|bmp|png|gif|yuv|svg|tiff|jps)/i;
var redundantPrefixRE = /^(Image|File):/i;

function clean_image_name(name) {
    name = name.replace(redundantPrefixRE, '');
    var m = name.match(imageFileRE);
    return m ? m[0] : '';
}


function get_conn() {
    var connection = mysql.createConnection({
        multipleStatements: true,
        // host: 'localhost',
        host: 'ec2-50-16-38-126.compute-1.amazonaws.com',
        user: 'root',
        database: 'wikipins',
        charset: 'utf8_unicode_ci'
    });
    return connection;
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
            var rids = [ /*283*/ ]; // FIXME
            var i;
            for (i = 0; i < n; ++i) {
                rids.push(Math.floor(Math.random() * row_count));
            }

            get_multi_category_id_images_and_count(rids, cb);

        });
    };
})(128, 30 * 60 * 1000);

// Returns a set of up to 8 images for the list of category IDs passed
// in.
function get_multi_category_id_images_and_count(category_ids, cb) {
    var connection = get_conn();

    connection.query("SELECT CI.category AS category, CI.image AS image, CL.count AS count " +
                     "FROM category_list CL, category_images CI " +
                     "WHERE CL.category = CI.category AND " +
                     "CL.id IN (?) ",
                     [ category_ids ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         var res = _.groupBy(rows, 'category');
                         cb(res);
                     });
    connection.end();
}

//
// Returns a set of up to 8 images for the list of categories passed
// in. The '8' is hard-coded in the data (database) itself.
//
function get_multi_category_images_and_count(categories, cb) {
    var connection = get_conn();

    connection.query("SELECT CI.category AS category, CI.image AS image, CL.count AS count " +
                     "FROM category_list CL, category_images CI " +
                     "WHERE CL.category = CI.category AND " +
                     "CI.category IN (?) ",
                     [ category ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         var res = _.groupBy(rows, 'category');
                         cb(res);
                     });
    connection.end();
}

function suggest_categories(category_prefix, n, cb) {
    /* SELECT category FROM category_list WHERE category LIKE ? LIMIT ? */
    var connection = get_conn();
    connection.query("SELECT category FROM category_list WHERE category LIKE ? LIMIT ?",
                     [category_prefix + "%", n], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb([]);
                             return;
                         }
                         console.log(rows);
                         var categories = _.pluck(rows, 'category');
                         cb(categories);
                     });
    connection.end();
}

// Given a list of titles, return a list of related categories along
// with their relative weights w.r.t. the titles passed in.
//
// Returns an array with each element being a hash of the following form:
// { category: CATEGORY_NAME, count: NUMBER_OF_TIME_THIS_CATEGORY_OCCURS }
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

/* Get the list of titles for a given category name */
function get_category_titles(category, cb) {
    /* SELECT title FROM categories WHERE category = ? */
    var connection = get_conn();
    connection.query("SELECT title FROM categories WHERE category = ?",
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
    connection.query("SELECT A.title AS title , A.abstract AS abstract, A.image AS image " +
                     "FROM abstracts A, " +
                     "(SELECT totitle FROM redirects WHERE fromtitle IN (?)) R " +
                     "WHERE R.totitle = A.title",
                     [ titles ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
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
    connection.query("SELECT A.title AS title, A.abstract AS abstract, A.image AS image " +
                     "FROM abstracts A WHERE A.title IN (?)",
                     [ titles ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
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
            cb(u);
        });
    });
}

function suggest(prefix, cb) {
    var connection = get_conn();
    connection.query("(SELECT category AS completion, 'C' AS type FROM categories WHERE category like '?%' LIMIT 10) " +
                     "UNION (SELECT title AS completion, 'A' AS type  FROM abstracts WHERE title like '?%' LIMIT 10)",
                     [ prefix ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             return;
                         }
                         var matches = rows;
                         cb(matches);
                     });
    connection.end();
}


function test(which) {
    if (which.suggest_categories) {
        suggest_categories(which.suggest_categories, 10, function(suggested_categories) {
            console.log("suggested_categories(", which.suggest_categories, ") = ", suggested_categories);
        });
    }

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
        // suggest_categories:                  "Pers",
        // get_multi_abstracts_by_title:        [ "Barack Obama", "Adolf Hitler", "Water" ],
        // get_category_titles:                 '13th-century deaths',
        // get_multi_category_images_and_count: ['13th-century deaths', '12th-century deaths'],
        // get_multi_categories_by_titles:      [ "Barack Obama", "George H. W. Bush", "Democrats", "Republicans", "Adolf Hitler", "Water" ]
        get_random_category_images:          true,
        get_related_categories:                 '13th-century deaths'
    });
}

exports.get_related_categories              = get_related_categories;
exports.suggest_categories                  = suggest_categories;
exports.get_multi_abstracts_by_title        = get_multi_abstracts_by_title;
exports.get_category_titles                 = get_category_titles;
exports.get_multi_category_images_and_count = get_multi_category_images_and_count;
exports.get_multi_categories_by_titles      = get_multi_categories_by_titles;
exports.get_random_category_images          = get_random_category_images;
exports.suggest                             = suggest
