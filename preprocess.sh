#! /bin/bash
TAB=`printf "\t"`
# http://www.madboa.com/geek/utf8/
export LANG=C
export LC_ALL=C

sort -f -k 1 -t "$TAB" -S 400M category.tsv > category.category.sorted.tsv
# sort -f -k 2 -t "$TAB" -S 400M category.tsv > category.title.sorted.tsv

# sort -f -k 1 -t "$TAB" -S 400M redirect.tsv > redirect.fromtitle.sorted.tsv

cat category.category.sorted.tsv | cut -d "$TAB" -f 1 category.tsv | uniq > category_list.tsv
