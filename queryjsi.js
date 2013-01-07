/* Query a sorted block-oriented JSON index file.
 *
 */

var fs      = require('fs');
var net     = require('net');
var util    = require("util");
var events  = require("events");
var carrier = require('carrier');
var algo    = require('algorithm-js');
var assert  = require('assert').ok;

var bsJsonRE = /^\{"bs":([0-9]+)/;

function LRUCache(maxEntries) {
    this.maxEntries = maxEntries;
    this.cache = { };
    this.listHead = null;
}

function QueryJSI(path) {
    this.path = path;
    this.fd   = fs.openSync(path, "r");
    var firstFew = new Buffer(32);
    fs.readSync(this.fd, firstFew, 0, 32, 0);
    var m = String(firstFew).match(bsJsonRE);
    assert(m);
    this.bs   = Number(m[1]);
    var metaBlock = new Buffer(this.bs);
    fs.readSync(this.fd, metaBlock, 0, this.bs, 0);
    this.metaBlock = JSON.parse(metaBlock);
    this.keys = this.metaBlock.keys;
    var s = fs.statSync(path);
    assert((s.size % this.bs) === 0);
    this.nBlocks = s.size / this.bs;
}

function Cursor(blockIndex, indexInBlock, pastLastBlockIndex, pastLastIndexInBlock,
                qjsi, parsedBlock) {
    this.blockIndex           = blockIndex;
    this.indexInBlock         = indexInBlock;
    this.pastLastBlockIndex   = pastLastBlockIndex;
    this.pastLastIndexInBlock = pastLastIndexInBlock;
    this.qjsi                 = qjsi;
    this.parsedBlock          = parsedBlock || qjsi.parse_block(blockIndex);
}

Cursor.prototype = {
    next: function() {
        if (this.blockIndex >= this.pastLastBlockIndex && this.indexInBlock >= this.pastLastIndexInBlock) {
            return false;
        }
        ++this.indexInBlock;
        if (this.indexInBlock < this.parsedBlock.length) {
            return true;
        }
        this.blockIndex = this.qjsi.getNextBlockIndex(this.blockIndex);
        this.indexInBlock = 0;
        if (this.blockIndex >= this.pastLastBlockIndex && this.indexInBlock >= this.pastLastIndexInBlock) {
            this.parsedBlock = [ ];
            return false;
        }
        this.parsedBlock = this.qjsi.parse_block(this.blockIndex);
        return true;
    },
    value: function() {
        if (this.indexInBlock < this.parsedBlock.length) {
            return this.parsedBlock[this.indexInBlock];
        }
        return null;
    }
};


LRUCache.prototype = {
    exists: function(key) {
        return this.cache.hasOwnProperty(key);
    },
    get: function(key) {
        assert(this.exists(key));
        var valueNode = this.cache[key];
        var newNode = { next: this.listHead, value: valueNode.value };
        return value;
    },
    add: function(key, value) {
    }
};

QueryJSI.prototype = {
    get_lb: function(key) {
        var cur = this.get_cursor(key);
        return cur.value();
    },
    get_cursor_lb: function(key) {
        var nDataBlocks = this.nBlocks - 1;
        // The interval [l, r)
        var l = 1, r = l + nDataBlocks;
        var m;
        var parsedBlock = [ ];
        var cur;
        var retBlock = r;
        while (l < r) {
            m = l + Math.floor((r - l) / 2);
            // console.log("l:", l, "r:", r, "m:", m);

            parsedBlock = this.parse_block(m);

            // If key <= parsedBlock[0], we move left.
            if (!this.is_less_than(parsedBlock[0], key)) {
                retBlock = m;
                r = m;
            }
            // if key > parsedBlock[parsedBlock.length - 1], we move right.
            else if (this.is_less_than(parsedBlock[parsedBlock.length - 1], key)) {
                l = m + 1;
            } else {
                // key > parsedBlock[0] && key <= parsedBlock[parsedBlock.length - 1]
                retBlock = m;
                break;
            }
        }
        cur = this.get_cursor_for_key(key, retBlock, this.parse_block(retBlock));
        return cur;
    },
    is_less_than: function(lhs, rhs) {
        var i;
        for (i = 0; i < this.keys.length; ++i) {
            var k = this.keys[i];
            var pos = k.position - 1;
            var klhs, krhs;
            assert(k.type === 's' || k.type === 'i' || k.type === 'n');
            assert(pos < rhs.length && pos < rhs.length);

            if (k.type === 's' || k.type === 'i') {
                klhs = (typeof lhs[pos] === 'string' ? lhs[pos] : String(lhs[pos]));
                krhs = (typeof rhs[pos] === 'string' ? rhs[pos] : String(rhs[pos]));
                if (k.type === 'i') {
                    klhs = klhs.toLowerCase();
                    krhs = krhs.toLowerCase();
                }
            } else {
                klhs = (typeof lhs[pos] === 'number' ? lhs[pos] : Number(lhs[pos]));
                krhs = (typeof rhs[pos] === 'number' ? rhs[pos] : Number(rhs[pos]));
            }

            if (klhs < krhs) {
                return true;
            }
            if (klhs > krhs) {
                return false;
            }
        }
        return false;
    },
    parse_block: function(index) {
        if (index >= this.nBlocks) {
            return [ ];
        }
        var blockBuffer = new Buffer(this.bs);
        fs.readSync(this.fd, blockBuffer, 0, this.bs, index * this.bs);
        var block = JSON.parse(blockBuffer);
        return block;
    },
    get_cursor_for_key: function(key, blockIndex, parsedBlock) {
        // console.info('get_cursor_for_key(', key, ',', blockIndex, ')');

        if (parsedBlock.length === 0) {
            return new Cursor(this.nBlocks, 0, this.nBlocks, 0, this, [ ]);
        }

        var cmp_eq = algo.cmp_eq_gen(this.is_less_than.bind(this));
        var i;
        for (i = 0; i < parsedBlock.length; ) {
            // console.info('Tuple:', parsedBlock[i]);
            if (this.is_less_than(parsedBlock[i], key)) {
                ++i;
            } else {
                return new Cursor(blockIndex, i, this.nBlocks, 0, this, parsedBlock);
            }

        } // for ()

        assert(false);
    },
    getNextBlockIndex: function(currentBlockIndex) {
        return currentBlockIndex + 1;
    }
};

exports.QueryJSI = QueryJSI;

// var qjsi = new QueryJSI('./ban.out');
var qjsi = new QueryJSI('./category.jsi');
console.log(qjsi.metaBlock);
console.log(qjsi);
console.log(qjsi.get_cursor_lb([ 'Opeth' ]).value());

var i;
var q = "Duck Go Dhruv HAL Zen Barack Array Spelling List Round Table Ridge".split(/ /);
for (i = 0; i < 9000; ++i) {
    var j = i % q.length;
    // console.log(q[i], "::", qjsi.get_cursor_lb([ q[i] ]).value());
    qjsi.get_cursor_lb([ q[j] ]);
}
