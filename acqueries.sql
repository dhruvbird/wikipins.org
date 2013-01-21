-- use wikipins;

DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS enhits;

set session sort_buffer_size = 400 * 1024 * 1024;


CREATE TABLE IF NOT EXISTS titles(title VARCHAR(200) NOT NULL,
       KEY (title(50))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE titles DISABLE KEYS;

LOAD DATA LOCAL INFILE 'titles.tsv'
     INTO TABLE titles
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n';

ALTER TABLE titles ENABLE KEYS;



CREATE TABLE IF NOT EXISTS categories(category VARCHAR(128) NOT NULL,
       KEY (category(50))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;


ALTER TABLE categories DISABLE KEYS;

LOAD DATA LOCAL INFILE 'category_list.tsv'
     INTO TABLE categories
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n'
     (@ccount, @cname)
     SET category = @cname;

ALTER TABLE categories ENABLE KEYS;





CREATE TABLE IF NOT EXISTS enhits(type ENUM('C', 'A') NOT NULL,
     title VARCHAR(200) NOT NULL,
     hits INT NOT NULL,
     KEY (title(50))
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

ALTER TABLE enhits DISABLE KEYS;

LOAD DATA LOCAL INFILE 'enCategoryHits.tsv'
     INTO TABLE enhits
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n'
     (@cname, @hits)
     SET type='C', category = @cname, hits = @hits;

LOAD DATA LOCAL INFILE 'enwikiHitsAll.tsv'
     INTO TABLE enhits
     FIELDS TERMINATED BY '\t'
     LINES TERMINATED BY '\n'
     (@title, @hits)
     SET type='A', title = @title, hits = @hits;

ALTER TABLE enhits ENABLE KEYS;


-- Dump the data to a file.
CREATE TABLE enallhits(title VARCHAR(200) NOT NULL,
       hits INT NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;

INSERT INTO enallhits(title, hits) 
 SELECT CONCAT('C:', C.category) AS title, COALESE(EH.hits, 0) AS hits 
 FROM categories C LEFT OUTER JOIN enhits EH 
 ON C.category = EH.title 
 WHERE EH.type = 'C' LIMIT 10;

INSERT INTO enallhits(title, hits) 
 SELECT CONCAT('A:', T.title) AS title, COALESE(EH.hits, 0) AS hits 
 FROM titles T LEFT OUTER JOIN enhits EH 
 ON T.title = EH.title 
 WHERE EH.type = 'A' LIMIT 10;

SELECT title, hits INTO OUTFILE '/tmp/enallhits.tsv' 
FROM enallhits;
