var parseXMLDumps = require('./xml_dump_parser.js').parseXMLDumps;
var spawn         = require('child_process').spawn;
var fs            = require('fs');

var parens = {
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>'
};

function unparen(title, text)  {
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
            // ncurly += (text[i] != '[' ? 1 : 0);
        } else if (pstk.length === 0) {
            if (title == 'Algeria') {
                // console.log(i);
            }
            out.push(text[i]);
        } else if (pstk[pstk.length - 1] === text[i]) {
            pstk.pop();
            posstk.pop();
        } else if (pstk[pstk.length - 1] === '>' && i - posstk[posstk.length - 1] > 16) {
            pstk.pop();
            posstk.pop();
        }
    }
    if (title == 'Algeria') {
        // console.log("LENGTH:", pstk.length);
        // console.log("RETURNING:", out.join(''));
    }
    return out.join('').replace(/\ ,/g, ',');
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
    text = text.substr(0, 2) + "  ";
    return !(text[0] === '<' || text[0] === '#' || text.substr(0, 2) === '{{');
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
    var imageRE    = /File:([^\|\]]+)(\||\])|image[^=]*=[\s]*([^\n]+)/;
    var redirectRE = /#REDIRECT (.+)/;

    function on_page(page) {
	var title = page.getChildText('title');
	var text  = page.getChild('revision').getChildText('text');
	var categories = text.match(categoryRE) || [ ];
	if (categories) {
	    categories = categories.map(function(category) {
		return category.match(catNameRE)[1];
	    }).filter(function(categoryName) {
		return categoryName.search(/[\|\*]/) == -1;
	    });
	}
	// console.log(title, categories);
	categories.forEach(function(categoryName) {
	    fs.writeSync(category_out, categoryName + "\t" + title + "\n");
	});

        var mi = text.match(imageRE);
	var noparens = unparen(title, text);
        var _abstract = '';
        var img = '';

        var lines = noparens.split('\n');

        if (title == 'Algeria') {
            // console.log(lines);
        }

        if (lines.length > 0) {
            var mr = lines[0].match(redirectRE);
            if (mr) {
                fs.writeSync(redirect_out, title + "\t" + mr[1] + "\n");
            } else {
                for (var i = 0; i < lines.length; ++i) {
                    if (title == 'Algeria' && i == 0) {
                        // console.log(noparens);
                    }
	            if (is_readable(lines[i]) && lines[i].length > 32) {
                        _abstract = lines[i];
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
                    fs.writeSync(abstract_out, title + "\t" + _abstract + "\t" + img + "\n");
                }
            }

        } // if (lines.length > 0)

    } // on_page()

    function on_end() {
    }

    parseXMLDumps(process.stdin, on_page, on_end);
}

main();
