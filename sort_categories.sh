#! /bin/bash
TAB=`printf "\t"`
sort -k 1 -t "$TAB" -S 300M category.tsv > category.category.sorted.tsv
sort -k 2 -t "$TAB" -S 300M category.tsv > category.title.sorted.tsv
