var expat   = require('node-expat');
var ltx     = require('ltx');
var assert  = require('assert').ok;
var fs      = require('fs');


/* Parses an XML file coming in on the input stream wikiDumpStream and
 * invokes the function 'callback' for each <page> element found. The
 * function 'endcb' is called when all the <page> tags have been
 * parsed and 'callback' will not be invoked any more for this file.
 */
function parseXMLDumps(wikiDumpStream, callback, endcb) {
    var parser = new expat.Parser('UTF-8');
    var currNode = null;

    function handleText(text) {
        if (currNode) {
            currNode.t(text);
        }
    }

    function handleStart(name, attrs) {
        var nn = new ltx.Element(name, attrs);
        if (currNode) {
            currNode = currNode.cnode(nn);
        } else {
            currNode = nn;
        }
        if (name == 'page') {
            currNode = nn;
        }
    }

    function handleEnd(name, attrs) {
        if (name == 'mediawiki') {
            endcb();
        }

        if (currNode == null) {
            return;
        }

        if (name == 'page') {
            callback(currNode);
            currNode = null;
        }

        if (currNode) {
            currNode = currNode.parent;
        }
    }


    parser.on("text",         handleText);
    parser.on("endElement",   handleEnd);
    parser.on("startElement", handleStart);

    wikiDumpStream.on('data', function(d) {
        parser.parse(d);
    });

}

exports.parseXMLDumps = parseXMLDumps;
