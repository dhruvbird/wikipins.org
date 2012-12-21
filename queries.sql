use wikipins;

CREATE TABLE IF NOT EXISTS abstracts(title VARCHAR(200) NOT NULL,
       abstract TEXT NOT NULL,
       image VARCHAR(300) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

LOAD DATA LOCAL INFILE 'abstract.tsv'
     INTO TABLE abstracts
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

DELETE FROM abstracts WHERE
       LENGTH(TRIM(title)) = 0 OR
       LENGTH(TRIM(abstract)) = 0 OR
       title LIKE 'Wikipedia:%' OR
       title LIKE 'File:%' OR
       title LIKE 'Special:%' OR
       title LIKE 'Category:%';

ALTER TABLE abstracts ADD INDEX (title);



CREATE TABLE IF NOT EXISTS categories(category VARCHAR(200) NOT NULL,
       title VARCHAR(200) NOT NULL,
       KEY (category)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- Make sure that category.tsv is sorted on the 'category' column, or
-- the insert will take too long. Adding the index post import is also
-- very slow with MyISAM.
LOAD DATA LOCAL INFILE 'category.tsv.sorted'
     INTO TABLE categories
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

