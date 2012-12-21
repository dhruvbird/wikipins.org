var parseXMLDumps = require('./xml_dump_parser.js').parseXMLDumps;
var spawn         = require('child_process').spawn;
var fs            = require('fs');

var parens = {
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>'
};

var narticles  = 0;
var nprocessed = 0;

function remove_paren_text(title, text) {
    var out = [ ];
    var i;
    var pstk = [ ];
    for (i = 0; i < text.length; ++i) {
        if (parens.hasOwnProperty(text[i])) {
            pstk.push(parens[text[i]]);
        } else if (pstk.length === 0) {
            out.push(text[i]);
        } else if (pstk[pstk.length - 1] === text[i]) {
            pstk.pop();
        }
    }
    return out.join('').trim();
}

function cleanup(title, text)  {
    // console.log("WAS:", text);
    text = text.replace(/\[\[([^\]\|]+)\]\]/g, '$1');
    text = text.replace(/\[\[([^\|]+)\|([^\]\|]+)\]\]/g, '$2');
    text = text.replace(/<ref[^\/]*\/>/g, ' ');
    text = text.replace(/<ref[^>]*>/g, '{').replace(/<\/ref>/g, '}');
    text = text.replace(/<div[^\/]*\/>/g, ' ');
    text = text.replace(/<div[^>]*>/g, '{').replace(/<\/div>/g, '}');
    text = text.replace(/<!--/g, '{').replace(/-->/g, '}');
    text = text.replace(/'{2,10}/g, '');

    if (title == 'Algeria') {
        // console.log("IS:", text);
    }

    var out = [ ];
    var i;
    var pstk = [ ];
    var posstk = [ ];
    for (i = 0; i < text.length; ++i) {
        if (parens.hasOwnProperty(text[i])) {
            pstk.push(parens[text[i]]);
            posstk.push(i);
        } else if (pstk.length === 0) {
            if (title == 'Algeria') {
                // console.log(i);
            }
            out.push(text[i]);
        } else if (pstk[pstk.length - 1] === text[i]) {
            pstk.pop();
            posstk.pop();
        } else if (pstk[pstk.length - 1] === '>' &&
                   i - posstk[posstk.length - 1] > 20) {
            // We might get stray < symbols which mean 'less than' and
            // are not part of ann open tag, so we discard them if
            // they remain open for too long. i.e. more than 20
            // characters.
            pstk.pop();
            posstk.pop();
        }
    }
    if (title == 'Algeria') {
        // console.log("LENGTH:", pstk.length);
        // console.log("RETURNING:", out.join(''));
    }
    return out.join('').replace(/\ ,/g, ',').trim();
}

function is_readable(text) {
    text = text.trim();
    if (text.search(/File:|Image:/) != -1) {
	return false;
    }
    if (text.search(/^\|/) != -1) {
	return false;
    }
    if (text.search(/==/) != -1) {
        return false;
    }
    if (text.search(/For the [^\.]+ see /) != -1) {
        return false;
    }
    text = text.substr(0, 2) + "  ";
    return !(text[0] === '<' || text[0] === '#' || text.substr(0, 2) === '{{');
}

function trim_to_read(text) {
    return text.replace(/^[^"'0-9a-zA-Z]+/, '').replace(/[^"'0-9a-zA-Z]+$/, '');
}

function getText(element, trim) {
    var text = "";
    if (trim && element.is && (element.is('a') || element.is('i'))) {
	var ename = element.name;
	element.name = '_' + element.name;
	text = getText(element, trim).split("|");
	if (text.length === 1) {
	    return text[0];
	}
	if (text.length === 2) {
	    return text[1];
	}
	element.name = ename;
	return '';
    }
    for (var i = 0; i < element.children.length; i++) {
	var child = element.children[i];
        if (typeof child == 'string') {
            text += child;
	} else {
	    text += getText(child, trim);
	}
    }
    return text;
};

function main() {
    var opts = require('tav').set({
        'abstract': {
            note: 'The path of the output TSV for article abstracts and images (default: ./abstract.tsv)',
            value: './abstract.tsv'
        },
        'category': {
            Note: 'The path of the output TSV for article abstracts and images (default: ./abstract.tsv)',
            value: './category.tsv'
        },
        'redirect': {
            Note: 'The path of the output TSV for article redirects (default: ./redirect.tsv)',
            value: './redirect.tsv'
        }
    }, 'Process the Wikipedia XML Dump producing the abstract+images, redirect & the category TSV files');

    process.stdin.resume();

    var abstract_out = fs.openSync(opts['abstract'], 'w');
    var category_out = fs.openSync(opts['category'], 'w');
    var redirect_out = fs.openSync(opts['redirect'], 'w');

    var categoryRE = /\[\[Category:[^\]]+\]\]/g;
    var catNameRE  = /\[\[Category:([^\]]+)\]\]/;
    var imageRE    = /File:([^\|\]]+)(\||\])|image[^=]*=[\ \t]*([^\n]+)/;
    var redirectRE = /#REDIRECT (.+)/;

    function on_page(page) {
	var title = page.getChildText('title').trim();
	var text  = page.getChild('revision').getChildText('text').trim();
        var ns    = page.getChildText('ns').trim();
	var categories = text.match(categoryRE) || [ ];
        narticles += 1;

        if (title.length === 0) {
            return;
        }

	if (categories) {
	    categories = categories.map(function(category) {
		return category.match(catNameRE)[1].trim();
	    }).filter(function(categoryName) {
                // Filter out category names that are empty or have a
                // | or a * character.
		return categoryName.length > 0 &&
                    categoryName.search(/[\|\*]/) == -1;
	    });
	}
	// console.log(title, ns, categories);
        if (title === 'Algeria' && ns != 0) {
            console.error("not ns 0:", title, ns);
        }
        if (ns != 0) {
            // Special page. Ignore me.
            return;
        }
	categories.forEach(function(categoryName) {
	    fs.writeSync(category_out, categoryName + "\t" + title + "\n");
	});

        var mi = text.match(imageRE);
	var text_cleaned = cleanup(title, text);
        var _abstract = '';
        var img = '';

        var lines = text_cleaned.split('\n').filter(function(line) {
            return line.length > 0;
        });

        if (title == 'Algeria') {
            // console.error(lines);
        }

        if (lines.length > 0) {
            var mr = lines[0].match(redirectRE);
            if (mr) {
                fs.writeSync(redirect_out, title + "\t" + mr[1] + "\n");
                nprocessed += 1;
            } else {
                for (var i = 0; i < lines.length; ++i) {
                    var line = trim_to_read(lines[i]);
                    if (title == 'Algeria' && i == 0) {
                        // console.error(lines);
                        // console.error("LINE:", line);
                    }

	            if (line.length > 63 && is_readable(line)) {
                        _abstract = line;
                        break;
	            }
                }
                if (mi) {
                    img = mi[1] || mi[3];
                    mi = img.match(imageRE);
                    if (mi) {
                        img = mi[1] || mi[3];
                    }
                }
                if (_abstract) {
                    img = remove_paren_text(title, img);
                    fs.writeSync(abstract_out, title + "\t" + _abstract + "\t" + img + "\n");
                    nprocessed += 1;

                } // if (_abstract)

            } // else

        } // if (lines.length > 0)

    } // on_page()

    function on_end() {
        console.log("Processed " + String(nprocessed) + "/" +
                    String(narticles) + " articles.");
    }

    parseXMLDumps(process.stdin, on_page, on_end);
}

main();
