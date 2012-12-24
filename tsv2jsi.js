/* Convert a sorted TSV file to a block-oriented JSON index file.
 *
 */

var fs      = require('fs');
var net     = require('net');
var util    = require("util");
var events  = require("events");
var carrier = require('carrier');

var bsJsonRE = /^\{"bs":([0-9]+)/;

function fill(ch, n) {
    var i;
    var rbuff = '';
    for (i = 0; i < n; ++i) {
        rbuff += ch;
    }
    return rbuff;
}

function keys2json(keys) {
    keys = keys.split(',');
    var kout = [ ];
    var i;
    var keyRE = /^([0-9]+)([sn]?)$/;
    for (i = 0; i < keys.length; ++i) {
        var m = keys[i].match(keyRE);
        if (!m) { throw new Error(util.format("The key '%s' doesn't look like a valid key", keys[i])); }
        kout.push({
            position: Number(m[1]),
            type:     m[2] ? m[2] : 's'
        });
    }
    if (kout.length === 0) {
        throw new Error("You must specify at least one key");
    }
    return kout;
}

function tsv2jsi(bs, fin, fdout, keys) {
    var ih = {
        bs: bs,
        keys: keys2json(keys)
    };
    var ihstr = JSON.stringify(ih);
    var rem = bs - ihstr.length;
    fs.writeSync(fdout, ihstr + fill(' ', rem));
    fin.resume();

    var block = '[';

    function on_got_line(line) {
        var jline = JSON.stringify(line.split('\t'));
        // 1 for the leading , and 1 for the closing ]
        var blockLen = Buffer.byteLength(block, 'utf8');
        if (blockLen + Buffer.byteLength(jline) + 2 <= bs) {
            block += (blockLen === 1 ? '' : ',');
            block += jline;
        } else {
            if (blockLen === 1) {
                throw new Error(
                    util.format("Block size %d too small for entry with size %d",
                                bs, jline)
                );
            }
            block += ']';
            blockLen += 1;
            fs.writeSync(fdout, block);
            rem = bs - blockLen;
            fs.writeSync(fdout, fill(' ', rem));
            block = '[' + jline;
        }
    }

    var lin = carrier.carry(fin, on_got_line);
    lin.on('end', function() {
        var blockLen = Buffer.byteLength(block, 'utf8');
        if (blockLen > 1) {
            block += ']';
            blockLen += 1;
            fs.writeSync(fdout, block);
            rem = bs - blockLen;
            fs.writeSync(fdout, fill(' ', rem));
            block = '[';
        }
    });
}


function main() {
    var opts = require('tav').set({
        'bs': {
            note: 'The block size of the index file (default: 16384)',
            value: 16384
        },
        'input': {
            Note: 'The path of the input TSV file. [empty] indicates stdin (default: [empty])',
            value: ''
        },
        'output': {
            Note: 'The path of the output JSI file. *Required* (default: [empty])',
            value: ''
        },
        'keys': {
            Note: 'A Comma Separated List indexes (starting from 1) of the KEY that the input file is ' +
                'sorted on. Optionally add suffix "s" or "n" to perform a String or Numeric comparison. ' +
                'The default prefix is "s". The input file *MUST* be sorted on this key. ' +
                'e.g. --keys="1s,5n,3" (default: 1s)',
            value: '1s'
        }
    }, 'TSV to JSI converted. JSI files are served by the jsid.js script');

    var fin   = process.stdin;
    var fdout = null;
    var bs    = opts.bs || 16384;
    var keys  = opts.keys;
    if (opts.input) {
        fin = new net.Stream(fs.openSync(opts.input, 'r'));
    }

    if (!opts.output) {
        console.error("Please specify --output");
        return;
    }

    fdout = fs.openSync(opts.output, 'w');

    tsv2jsi(bs, fin, fdout, keys);
}

main();
