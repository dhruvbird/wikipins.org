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
       PRIMARY KEY (category, title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


-- Sort the categories.tsv file before importing.
--
-- TAB=`printf "\t"`
-- sort -k 1 -t "$TAB" -S 300M category.tsv > category.category.sorted.tsv
-- sort -k 2 -t "$TAB" -S 300M category.tsv > category.title.sorted.tsv
--
-- Make sure that category.tsv is sorted on the 'category' column, or
-- the insert will take too long. Adding the index post import is also
-- very slow with MyISAM. Hence, we just use 2 tables to be done with
-- things quickly.
LOAD DATA LOCAL INFILE 'category.category.sorted.tsv'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';




CREATE TABLE IF NOT EXISTS title_categories(category VARCHAR(200) NOT NULL,
       title VARCHAR(200) NOT NULL,
       PRIMARY KEY (title, category)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


LOAD DATA LOCAL INFILE 'category.title.sorted.tsv'
     INTO TABLE title_categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';






CREATE TABLE IF NOT EXISTS redirects(fromtitle VARCHAR(200) NOT NULL,
       totitle VARCHAR(200) NOT NULL,
       PRIMARY KEY (fromtitle)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

LOAD DATA LOCAL INFILE 'redirect.tsv' IGNORE
     INTO TABLE redirects
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

