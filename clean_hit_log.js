/* Clean wikipedia hit logs.
 *
 */

var fs      = require('fs');
var util    = require("util");
var events  = require("events");
var carrier = require('carrier');

function main() {
    var opts = require('tav').set({
        'type': {
            note: 'The type of hit logs. Values: (category|article) (default: category)',
            value: 'category' // This is currently unused.
        }
    }, 'Clean wikipedia hit logs');

    process.stdin.resume();
    var fin = process.stdin;
    var lin = carrier.carry(fin, on_got_line);
    var splitRE = /\s+/g;
    var cprefixRE = /^\s*category:/i;

    function on_got_line(line) {
        var parts = line.split(splitRE);
        var title = parts[1];
        var hits  = parts[2]
        var b = new Buffer(unescape(title), 'binary');
        title = b.toString('utf8');
        title = title.replace(cprefixRE, '');
        title = title.replace(/_/g, ' ').trim();
        if (title.length > 0) {
            process.stdout.write(title + "\t" + hits + "\n");
        }
    }

}

main();
