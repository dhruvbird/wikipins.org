<?php
	/**
	 * Convert standard input from Wiki text to HTML.
	 * (c) 2007, Frank Schoep
	 * 
	 * This script will convert the standard input stream from Wiki style
	 * text syntax to minimally formatted HTML output on the standard
	 * output stream.
	 */

	// include the Wiki text to HTML class
	require_once './wikitexttohtml.php';

	// convert standard input to HTML output array
	$output = WikiTextToHTML::convertWikiTextStreamToHTML(STDIN);
	
	// output to stream with newlines
	foreach($output as $line) {
		echo "${line}\n";
	}
