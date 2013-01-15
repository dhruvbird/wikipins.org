var mysql = require('mysql');
var _     = require('underscore');

var imageFileRE = /[^\|]+\.(jpg|jpeg|bmp|png|gif|yuv|svg|tiff|jps)/i;



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
                get_multi_category_images_and_count(categories, function(res) {
                    cached = res;
                    prev_ts = new Date();
                    cb(cached);
                });
            });
        });
    };
})(128, 10 * 60 * 1000);

// Returns a set of up to 10 images for a given category.
function get_category_images_and_count(category, conn, cb) {
    /* SELECT image FROM categories C, abstracts A
     * WHERE
     * A.title = C.title AND
     * C.category = ? AND
     * LENGTH(A.image) > 4
     * LIMIT 4
     */
    connection = conn || get_conn();
    connection.query("SELECT A.image AS image, CL.count AS count FROM categories C, abstracts A, category_list CL " +
                     "WHERE A.title = C.title AND CL.category = C.category AND " +
                     "C.category = ? AND LENGTH(A.image) > 4 LIMIT 10",
                     [ category ], function(err, rows, fields) {
                         if (err) {
                             console.error(err);
                             cb(category, [ ]);
                             return;
                         }
                         var images = _.pluck(rows, 'image').map(function(img) {
                             var m = img.match(imageFileRE);
                             return m ? m[0] : null;
                         }).filter(function(img) { return !!img; });
                         var count = rows.length > 0 ? rows[0].count : 0;
                         cb(category, {
                             images: images,
                             count: count
                         });
                     });
    if (!conn) {
        connection.end();
    }
}

// Returns a set of up to 8 images for the list of categories passed
// in.
function get_multi_category_images_and_count(categories, cb) {
    var ctr = -1;
    var res = { };
    var connection = get_conn();

    function next(category, images_count) {
        if (ctr > -1) {
            res[category] = images_count;
        }
        ctr += 1;
        if (ctr === categories.length) {
            connection.end();
            cb(res);
        } else {
            get_category_images_and_count(categories[ctr], connection, next);
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
    connection.query("SELECT category, COUNT(*) as count FROM title_categories " +
                     "WHERE title IN (?) GROUP BY category",
                     [ titles ], function(err, rows, fields) {
                         cb(rows);
                     });
}

function get_related_categories(category, cb) {
    var connection = get_conn();
    connection.query("SELECT TC.category AS category, COUNT(*) as count " +
                     "FROM title_categories TC JOIN categories C " +
                     "ON C.title=TC.title " +
                     "WHERE C.category = ? " +
                     "GROUP BY category ORDER BY count DESC", [ category ], function(err, rows, fields) {
                         cb(rows);
                     });
    connection.end();
}

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
