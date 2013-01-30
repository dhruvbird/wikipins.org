#! /bin/bash

truncate --size=0 titles.tsv
echo "select title from abstracts" | ~/mysql.sh wikipins -N | LANG=C egrep -U "^[[:print:]]+$" >> titles.tsv
echo "select fromtitle from redirects" | ~/mysql.sh wikipins -N | LANG=C egrep -U "^[[:print:]]+$" >> titles.tsv
echo "select totitle from redirects" | ~/mysql.sh wikipins -N | LANG=C egrep -U "^[[:print:]]+$" >> titles.tsv

LANG=C sort -S 300M -k 1 titles.tsv | LANG=C uniq > titles.sorted.tsv
rm titles.tsv
