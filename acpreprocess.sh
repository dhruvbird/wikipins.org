#! /bin/bash

TAB=`printf "\t"`
export LANG=C
export LC_ALL=C

# Clean the hit logs
node ../clean_hit_log.js < enCategoryHits.txt > enCatCleaned.tsv

# Sort them
sort -f -k 1 -t "$TAB" -S 400M enCatCleaned.tsv | awk -f ../merge_uniq.awk > enCategoryHits.tsv
