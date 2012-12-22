use wikipins;

DROP TABLE IF EXISTS abstracts;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS redirects;


CREATE TABLE IF NOT EXISTS abstracts(title VARCHAR(200) NOT NULL,
       abstract TEXT NOT NULL,
       image VARCHAR(300) NOT NULL,
       KEY (title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

ALTER TABLE abstracts DISABLE KEYS;

LOAD DATA LOCAL INFILE 'abstract.tsv'
     INTO TABLE abstracts
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE abstracts ENABLE KEYS;



CREATE TABLE IF NOT EXISTS categories(category VARCHAR(200) NOT NULL,
       title VARCHAR(200) NOT NULL,
       KEY (category),
       KEY (title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

ALTER TABLE categories DISABLE KEYS;

-- Sort the categories.tsv file before importing.  This sorts the file
-- categories.tsv according to the first word, but this is enough for
-- us since it results in a mostly sorted file, which is easily
-- imported by MySQL.
--
-- sort -k 1 -S 128M category.tsv > category.tsv.sorted
--
-- Make sure that category.tsv is sorted on the 'category' column, or
-- the insert will take too long. Adding the index post import is also
-- very slow with MyISAM.
LOAD DATA LOCAL INFILE 'category.tsv.sorted'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE categories ENABLE KEYS;



CREATE TABLE IF NOT EXISTS redirects(fromtitle VARCHAR(200) NOT NULL,
       totitle VARCHAR(200) NOT NULL,
       PRIMARY KEY (fromtitle)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

LOAD DATA LOCAL INFILE 'redirect.tsv' IGNORE
     INTO TABLE redirects
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';


