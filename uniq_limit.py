#! /usr/bin/python

# Print out only up to K unique keys per key in the input.

import sys

delim = '\t'
fidx  = 0
K     = 8
n     = 0 # The # of consecutive lines read till now.

prevKey = ''
prevLine = ''
gotLine = False

try:
    line  = raw_input()
    parts = line.split(delim)
    prevLine = line
    prevKey  = parts[fidx]
    n = 1

    sys.stdout.write(line + "\n")

    while True:
        line  = raw_input()
        parts = line.split(delim)
        if parts[fidx] == prevKey:
            n += 1
            if n <= K:
                sys.stdout.write(line + "\n")
        else:
            prevLine = line
            prevKey  = parts[fidx]
            sys.stdout.write(line + "\n")
            n = 1

except EOFError, ex:
    pass
