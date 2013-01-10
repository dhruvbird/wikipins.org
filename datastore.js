var mysql = require('mysql');
var _     = require('underscore');




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
    var prev_ts = new Date() - delay - 100000;
    return function(cb) {
        if (new Date() - prev_ts < delay) {
            cb(cached);
            return;
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
                cb(err);
                return;
            }
            var row_count = rows[0].count;
            var rids = [ ];
            var i;
            for (i = 0; i < n; ++i) {
                rids.push(Math.floor(Math.random() * row_count));
            }

            connection.query('SELECT CL.category AS category FROM category_list CL WHERE CL.id IN (?)', [ rids ], function(err, rows, fields) {
                if (err) {
                    console.error(err.stack);
                    cb(err);
                    return;
                }
                connection.end();
                var categories = _.pluck(rows, 'category');
                /* Get images for these categories */
                get_multi_category_images(categories, function(res) {
                    cached = res;
                    cb(cached);
                });
            });
        });
    };
})(128, 10 * 60 * 1000);

// Returns a set of up to 10 images for a given category.
function get_category_images(category, conn, cb) {
    /* SELECT image FROM categories C, abstracts A
     * WHERE
     * A.title = C.title AND
     * C.category = ? AND
     * LENGTH(A.image) > 4
     * LIMIT 4
     */
    connection = conn || get_conn();
    connection.query("SELECT image FROM categories C, abstracts A " +
                     "WHERE A.title = C.title AND C.category = ? AND LENGTH(A.image) > 4 LIMIT 10",
                     [ category ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         var images = _.pluck(rows, 'image').filter(function(img) {
                             return img.search(/=/) == -1;
                         });
                         cb(category, images);
                     });
    if (!conn) {
        connection.end();
    }
}

// Returns a set of up to 8 images for the list of categories passed
// in.
function get_multi_category_images(categories, cb) {
    var ctr = -1;
    var res = { };
    var connection = get_conn();

    function next(category, images) {
        if (ctr > -1) {
            res[category] = images;
        }
        ctr += 1;
        if (ctr === categories.length) {
            connection.end();
            cb(res);
        } else {
            get_category_images(categories[ctr], connection, next);
        }
    }
    next('', []);
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

// Returns an array with each element being a hash of the following form:
// { category: CATEGORY_NAME, count: NUMBER_OF_TIME_THIS_CATEGORY_OCCURS }
function get_multi_categories_by_titles(titles, cb) {
    /* SELECT category, COUNT(*) as count FROM title_categories
       WHERE title IN ? GROUP BY category
    */
    var connection = get_conn();
    connection.query("SELECT DISTINCT category, COUNT(*) as count FROM title_categories " +
                     "WHERE title IN ? GROUP BY category",
                     titles, function(err, rows, fields) {
                         cb(rows);
                     });
}

function get_category_titles(category, cb) {
    /* SELECT title FROM categories WHERE category = ? */
    var connection = get_conn();
    connection.query("SELECT title FROM categories WHERE category = ?",
                     category, function(err, rows, fields) {
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
                         cb(rows);
                     });
    connection.end();
}

function get_multi_abstracts_by_title_noredirect(titles, cb) {
    /* SELECT A.title AS title , A.abstract AS abstract, A.image AS image
       FROM abstracts A WHERE A.title IN ?;
    */
    var connection = get_conn();
    connection.query("SELECT A.title AS title, A.abstract AS abstract, A.image AS image " +
                     "FROM abstracts A WHERE A.title IN (?)",
                     [ titles ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             return;
                         }
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


/*
suggest_categories("Pers", 10, function() {
    console.log(arguments);
});
*/

/*
get_multi_abstracts_by_title([ "Barack Obama", "Adolf Hitler", "Water" ], function() {
    console.log(arguments);
});
*/

/*
get_category_titles('13th-century deaths', function(titles) {
    get_multi_abstracts_by_title(titles, function(abstracts) {
        console.log(abstracts);
    });
});
*/

/*
get_multi_category_images(['13th-century deaths', '12th-century deaths'], function() {
    console.log(arguments);
});
*/

get_random_category_images(function(rci) {
    console.log(rci);
});
