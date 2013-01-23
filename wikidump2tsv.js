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

var imageFileRE      = /[^\|\[\]\n=]+\.(jpg|jpeg|bmp|png|gif|yuv|svg|tiff|jps)/ig;
var badImagePrefixRE = /^(file:|image:)/i;
var maybeUrlRE       = /http:\/\//;
var wsRE             = /\s+/g;

var MONITOR_TITLE = "Algeria";

function get_image_name(title, text) {
    var mi = text.match(imageFileRE);
    var img = '';
    if (mi) {
        mi = mi.map(function(iname) {
            if (iname.search(maybeUrlRE) != -1) {
                return '';
            }
            return iname.replace(badImagePrefixRE, '').trim();
        }).filter(function(iname) {
            return !!iname;
        });
        if (mi.length > 0) {
            img = mi[0];
        }
    }
    return img;
}

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

    if (title == MONITOR_TITLE) {
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
            if (title == MONITOR_TITLE) {
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
    if (title == MONITOR_TITLE) {
        // console.log("LENGTH:", pstk.length);
        // console.log("RETURNING:", out.join(''));
    }
    var s = out.join('').replace(/\s+,/g, ',');
    return s.trim();
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

function cleanup_ws(text) {
    return text.replace(wsRE, ' ');
}

function trim_to_read(text) {
    return cleanup_ws(text.replace(/^[^"'0-9a-zA-Z]+/, '').replace(/[^"'0-9a-zA-Z]+$/, ''));
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
            Note: 'The path of the output TSV for article abstracts and images (default: ./category.tsv)',
            value: './category.tsv'
        },
        'redirect': {
            Note: 'The path of the output TSV for article redirects (default: ./redirect.tsv)',
            value: './redirect.tsv'
        },
        'image': {
            Note: 'The path of the output TSV for image file names (default: ./image.tsv)',
            value: './image.tsv'
        },
        'cimage': {
            Note: 'The path of the output TSV for category image list file (default: ./cimage.tsv)',
            value: './cimage.tsv'
        }
    }, 'Process the Wikipedia XML Dump producing the abstract+images, redirect & the category TSV files');

    process.stdin.resume();

    var abstract_out = fs.openSync(opts['abstract'], 'w');
    var category_out = fs.openSync(opts['category'], 'w');
    var redirect_out = fs.openSync(opts['redirect'], 'w');
    var image_out    = fs.openSync(opts['image'], 'w');
    var cimage_out   = fs.openSync(opts['cimage'], 'w');

    var categoryRE = /\[\[Category:[^\]\n\|]+(\|[^\]\n]+)?\]\]/ig;
    var catNameRE  = /\[\[Category:([^\]\n\|]+)/i;

    function on_page(page) {
	var title = page.getChildText('title').trim();
	var text  = page.getChild('revision').getChildText('text').trim();
        var ns    = Number(page.getChildText('ns').trim());
	var categories = text.match(categoryRE) || [ ];
        var redirect   = page.getChild('redirect');
        var redirect_to = '';
        if (redirect) {
            redirect_to = redirect.attrs['title'] || '';
        }
        narticles += 1;

        if (title.length === 0) {
            return;
        }

	if (categories) {
	    categories = categories.map(function(category) {
		return cleanup_ws(category.match(catNameRE)[1]).trim();
	    }).filter(function(categoryName) {
                // Filter out category names that are empty or have a
                // | or a * character. - why do we do the * thing??
		return categoryName.length > 0 && categoryName.search(/[\|\*]/) === -1;
	    });
	}

        if (ns == 6) {
            var img = get_image_name(title, title);
            if (img) {
	        fs.writeSync(image_out, img + "\n");
            }
        }

	// console.log(title, ns, categories);
        if (title === MONITOR_TITLE && ns != 0) {
            console.error("not ns 0:", title, ns);
        }
        if (ns != 0) {
            // Special page. Ignore me.
            return;
        }

        // Write out the categories
	categories.forEach(function(categoryName) {
	    fs.writeSync(category_out, categoryName + "\t" + title + "\n");
	});

	var text_cleaned = cleanup(title, text);
        var _abstract = '';
        var img = get_image_name(title, text);

        var lines = text_cleaned.split('\n').filter(function(line) {
            return line.length > 0;
        });

        if (title == MONITOR_TITLE) {
            // console.error(lines);
        }

        nprocessed += 1;

        if (redirect_to) {
            fs.writeSync(redirect_out, title + "\t" + redirect_to + "\n");
        } else if (lines.length > 0) {
            for (var i = 0; i < lines.length; ++i) {
                var line = trim_to_read(lines[i]);
                if (i == 0 && title == MONITOR_TITLE) {
                    // console.error(lines);
                    // console.error("LINE:", line);
                }
                
	        if (line.length > 63 && is_readable(line)) {
                    _abstract = line;
                    break;
	        }
            }
            
            if (_abstract) {
                fs.writeSync(abstract_out, title + "\t" + _abstract + "\t" + img + "\n");
                nprocessed += 1;
                
            } // if (_abstract)

        } // if (lines.length > 0)

        // Only write out image names that are > 4 characters in length
        if (img.length > 4) {
            // Write out the category-images
	    categories.forEach(function(categoryName) {
	        fs.writeSync(cimage_out, categoryName + "\t" + title + "\t" + img + "\n");
	    });
        }

    } // on_page()

    function on_end() {
        console.log("Processed " + String(nprocessed) + "/" +
                    String(narticles) + " articles.");
    }

    parseXMLDumps(process.stdin, on_page, on_end);
}

main();
