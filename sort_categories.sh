#! /bin/bash
TAB=`printf "\t"`
export LANG=en_US
export LC_ALL=en_US
sort -f -k 1 -t "$TAB" -S 400M category.tsv > category.category.sorted.tsv
sort -f -k 2 -t "$TAB" -S 400M category.tsv > category.title.sorted.tsv
