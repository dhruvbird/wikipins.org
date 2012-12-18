var parseXMLDumps = require('./xml_dump_parser.js').parseXMLDumps;
var spawn         = require('child_process').spawn;
var fs            = require('fs');
var ltx           = require('ltx');

var PROCESS_POOL_SIZE = 6;
var nrunning_jobs     = 0;

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
    var imageRE    = /File:([^|]+)|/g;

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

	job2pool('/usr/bin/php', [ './mw2html.php' ], text, function(code, stdout) {
	    var nodes = { };
	    var p = [ ];
	    stdout = stdout.replace(/<b>/g, "<i>").replace(/<\/b>/g, "</i>")
		.replace(/<span/g, "<i").replace(/<\/span>/g, "</i>");
	    var prefix = stdout.split(/<\/p>/).slice(0, 4);
	    while (prefix.length > 0 && prefix[prefix.length - 1].trim().length === 0) {
		prefix.pop();
	    }
	    prefix = prefix.join('</p>') + '</p>\n';
	    var xml_data = "<dummy>" + prefix + "</dummy>";

	    try {
		nodes = ltx.parse(xml_data);
		p = nodes.getChildren('p').slice(0, 5);
		p = p.map(function(pnode) {
		    return pnode.getText();
		});
	    } catch (ex) {
		console.error("Exception:", ex);
		console.error("Input was:\n", xml_data + "\n ----- \n");
	    }
	    fs.writeSync(abstract_out, title + "\t" + p + "\n");
	});

    }

    function on_end() {
    }

    parseXMLDumps(process.stdin, on_page, on_end);
}

main();
