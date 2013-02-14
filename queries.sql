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
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_general_ci;

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
       KEY (fromtitle(180))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_general_ci;

ALTER TABLE redirects DISABLE KEYS;

LOAD DATA LOCAL INFILE 'redirect.tsv' IGNORE
     INTO TABLE redirects
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE redirects ENABLE KEYS;


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

LOAD DATA LOCAL INFILE 'image_commons.importable.tsv' IGNORE
     INTO TABLE images
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

-- Load popular articles into the DB
--
LOAD DATA LOCAL INFILE 'popular_articles.tsv'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

INSERT INTO category_list(category, count, id) VALUES('Popular Articles', 80, -10);

INSERT INTO category_images (SELECT C.category, A.title, A.image 
  FROM categories C, abstracts A 
  WHERE C.category='Popular Articles' 
    AND C.title COLLATE utf8_unicode_ci=A.title LIMIT 8
);
