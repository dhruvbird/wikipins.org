use wikipins;

DROP TABLE IF EXISTS abstracts;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS title_categories;
DROP TABLE IF EXISTS category_list;
DROP TABLE IF EXISTS redirects;

set session sort_buffer_size = 400 * 1024 * 1024;


CREATE TABLE IF NOT EXISTS abstracts(title VARCHAR(200) NOT NULL,
       abstract TEXT NOT NULL,
       image VARCHAR(300) NOT NULL,
       KEY (title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE abstracts DISABLE KEYS;

LOAD DATA LOCAL INFILE 'abstract.tsv'
     INTO TABLE abstracts
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE abstracts ENABLE KEYS;



CREATE TABLE IF NOT EXISTS categories(category VARCHAR(128) NOT NULL,
       title VARCHAR(128) NOT NULL,
       KEY (category(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;


-- Sort the categories.tsv file before importing.
--
-- TAB=`printf "\t"`
-- sort -f -k 1 -t "$TAB" -S 300M category.tsv > category.category.sorted.tsv
-- sort -f -k 2 -t "$TAB" -S 300M category.tsv > category.title.sorted.tsv
--
-- Make sure that category.tsv is sorted on the 'category' column, or
-- the insert will take too long. Adding the index post import is also
-- very slow with MyISAM. Hence, we just use 2 tables to be done with
-- things quickly.
ALTER TABLE categories DISABLE KEYS;

LOAD DATA LOCAL INFILE 'category.category.sorted.tsv'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE categories ENABLE KEYS;





CREATE TABLE IF NOT EXISTS title_categories(category VARCHAR(128) NOT NULL,
       title VARCHAR(128) NOT NULL,
       KEY (title(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;


ALTER TABLE title_categories DISABLE KEYS;

LOAD DATA LOCAL INFILE 'category.title.sorted.tsv'
     INTO TABLE title_categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE title_categories ENABLE KEYS;



CREATE TABLE IF NOT EXISTS category_list(category VARCHAR(128) NOT NULL,
     count INT NOT NULL,
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     KEY (category(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

INSERT INTO category_list(category, count) (SELECT category, COUNT(*) FROM categories GROUP BY category);




-- Sort the redirects file on the 'fromtitle' colum before importing.

CREATE TABLE IF NOT EXISTS redirects(fromtitle VARCHAR(180) NOT NULL,
       totitle VARCHAR(180) NOT NULL,
       PRIMARY KEY (fromtitle)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

LOAD DATA LOCAL INFILE 'redirect.fromtitle.sorted.tsv' IGNORE
     INTO TABLE redirects
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';


-- Load the images table

CREATE TABLE IF NOT EXISTS images(image_name VARCHAR(200),
       KEY (image_name(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

LOAD DATA LOCAL INFILE 'image.tsv' IGNORE
     INTO TABLE images
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';
