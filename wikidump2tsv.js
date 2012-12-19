var parseXMLDumps = require('./xml_dump_parser.js').parseXMLDumps;
var spawn         = require('child_process').spawn;
var fs            = require('fs');
var ltx           = require('ltx');

var PROCESS_POOL_SIZE = 6;
var nrunning_jobs     = 0;

function is_readable(text) {
    text = text.trim();
    if (text.search(/File:|Image:/) != -1) {
	return false;
    }
    if (text.search(/^\|/) != -1) {
	return false;
    }
    text = text.substr(0, 2) + "  ";
    return !(text[0] === '<' || text[0] === '#' || text.substr(0, 2) === '{{');
}

function cleanup(text) {
    return text.replace(/\([^\)]*\)/g, ' ').
	replace(/<[^>]*>/g, ' ').
	replace(/http[s]?:\/\/[\S]+/g, ' ');
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

function job2pool(cmd, args, stdin, cb) {
    if (nrunning_jobs >= PROCESS_POOL_SIZE) {
	process.stdin.pause();
    }

    var cp = spawn(cmd, args);
    var cp_stdout = '';
    ++nrunning_jobs;
    cp.stdout.on('data', function(data) {
	cp_stdout += String(data);
    });
    cp.on('exit', function(code) {
	--nrunning_jobs;
	if (nrunning_jobs < 2) {
	    process.stdin.resume();
	}
	cb(code, cp_stdout);
    });
    cp.stdin.write(stdin);
    cp.stdin.end();
}

function main() {
    var opts = require('tav').set({
        'abstract': {
            note: 'The path of the output TSV for article abstracts and images (default: ./abstract.tsv)',
            value: './abstract.tsv'
        },
        'category': {
            Note: 'The path of the output TSV for article abstracts and images (default: ./abstract.tsv)',
            value: './category.tsv'
        }
    }, 'Process the Wikipedia XML Dump producing the abstract+images & the category TSV files');

    // opts['abstract']
    // opts['category']
    process.stdin.resume();

    var abstract_out = fs.openSync(opts['abstract'], 'w');
    var category_out = fs.openSync(opts['category'], 'w');

    var categoryRE = /\[\[Category:[^\]]+\]\]/g;
    var catNameRE  = /\[\[Category:([^\]]+)\]\]/;
    var imageRE    = /File:([^\|]+)\|/;

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

	var tnext = text.split('}}\n\n').slice(1).join('}}\n\n');

	job2pool('/usr/bin/php', [ './mw2html.php' ], tnext, function(code, stdout) {
	    var nodes = { };
	    var p = [ ];
	    stdout = stdout.replace(/<b>/g, "<i>").replace(/<\/b>/g, "</i>")
		.replace(/<span/g, "<i").replace(/<\/span>/g, "</i>");
	    var prefix = stdout.split(/<\/p>/).slice(0, 7);
	    while (prefix.length > 0 && prefix[prefix.length - 1].trim().length === 0) {
		prefix.pop();
	    }
	    prefix = prefix.join('</p>') + '</p>\n';
	    var xml_data = "<dummy>" + prefix + "</dummy>";
	    var img      = '';

	    try {
		nodes = ltx.parse(xml_data);
		p = nodes.getChildren('p').slice(0, 6);
		p = p.map(function(pnode) {
		    var text = getText(pnode, false);
		    var mi   = text.match(imageRE);
		    // console.log(text);
		    if (mi) {
			// console.log(mi);
			img = mi[1];
			return '';
		    }
		    text = cleanup(getText(pnode, true)).trim();
		    if (is_readable(text)) {
			return text;
			// return String(pnode);
		    }
		    return '';
		}).filter(function(text) {
		    return text.length > 0;
		});
	    } catch (ex) {
		console.error("Exception:", ex.stack);
		console.error("Input was:\n", xml_data + "\n ----- \n");
	    }
	    var _abstract = (p.length > 0 ? p[0] : '');
	    fs.writeSync(abstract_out, title + "\t" + _abstract + "\t" + img + "\n");
	});

    }

    function on_end() {
    }

    parseXMLDumps(process.stdin, on_page, on_end);
}

main();
