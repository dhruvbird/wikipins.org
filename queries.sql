-- use wikipins;

DROP TABLE IF EXISTS abstracts;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS title_categories;
DROP TABLE IF EXISTS category_images;
DROP TABLE IF EXISTS category_list;
DROP TABLE IF EXISTS redirects;
DROP TABLE IF EXISTS images;

set session sort_buffer_size = 400 * 1024 * 1024;


CREATE TABLE IF NOT EXISTS abstracts(title VARCHAR(200) NOT NULL,
       abstract TEXT NOT NULL,
       image VARCHAR(300) NOT NULL,
       KEY (title(50))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE abstracts DISABLE KEYS;

LOAD DATA LOCAL INFILE 'abstract.tsv'
     INTO TABLE abstracts
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE abstracts ENABLE KEYS;



CREATE TABLE IF NOT EXISTS categories(category VARCHAR(128) NOT NULL,
       title VARCHAR(128) NOT NULL,
       KEY (category(40)),
       KEY (title(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;


ALTER TABLE categories DISABLE KEYS;

LOAD DATA LOCAL INFILE 'category.category.sorted.tsv'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE categories ENABLE KEYS;





CREATE TABLE IF NOT EXISTS category_list(category VARCHAR(128) NOT NULL,
     count INT NOT NULL,
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     KEY (category(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE category_list DISABLE KEYS;

LOAD DATA LOCAL INFILE 'category_list.tsv'
     INTO TABLE category_list
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n'
     (@ccount, @cname)
     SET category = @cname, count = @ccount;

ALTER TABLE category_list ENABLE KEYS;



CREATE TABLE IF NOT EXISTS category_images(category VARCHAR(128) NOT NULL,
     title VARCHAR(200) NOT NULL,
     image VARCHAR(300) NOT NULL,
     KEY (category(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE category_images DISABLE KEYS;

LOAD DATA LOCAL INFILE 'cimage.reduced.tsv' IGNORE
     INTO TABLE category_images
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE category_images ENABLE KEYS;



CREATE TABLE IF NOT EXISTS redirects(fromtitle VARCHAR(180) NOT NULL,
       totitle VARCHAR(180) NOT NULL,
       PRIMARY KEY (fromtitle)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

LOAD DATA LOCAL INFILE 'redirect.tsv' IGNORE
     INTO TABLE redirects
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';


-- Load the images table. The PK here doesn't cause a problem since
-- there are just ~90k articles with images in the whole of english
-- wikipedia, and we just pick up the 1st image in every article.

CREATE TABLE IF NOT EXISTS images(image_name VARCHAR(200),
       PRIMARY KEY (image_name(40))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

LOAD DATA LOCAL INFILE 'image.tsv' IGNORE
     INTO TABLE images
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';
