#! /bin/bash
TAB=`printf "\t"`
# http://www.madboa.com/geek/utf8/
export LANG=C
export LC_ALL=C

# Generate sorted categories
sort -f -k 1 -t "$TAB" -S 300M category.tsv > category.category.sorted.tsv

# Generate category list to import into the table 'category_list'
cut -d "$TAB" -f 1 category.category.sorted.tsv | uniq -c | sed 's/\ *\([0-9]\+\)\ /\1\t/' > category_list.tsv

CL_LINES=`wc -l category_list.tsv`
echo "There are ${CL_LINES} unique categories"

# Generate list of category images
sort -k 1 -t "$TAB" -S 300M cimage.tsv | python ../uniq_limit.py > cimage.reduced.tsv

if [ -e image_commons.tsv ]
then
    # Get list of image names used
    cut -d "$TAB" -f 3 abstract.tsv | sort -f -S 300M | uniq | grep -v "^\s*$" > referenced_images.sorted.tsv

    # Sort image_commons.tsv
    sort -S 300M -f image_commons.tsv > image_commons.sorted.tsv

    # Join with images in commons
    join -i --check-order referenced_images.sorted.tsv image_commons.sorted.tsv > images_commons.importable.tsv
else
    truncate --size=0 images_commons.importable.tsv
fi

ICI_LINES=`wc -l images_commons.importable.tsv`
echo "images_commons.importable.tsv has ${ICI_LINES} lines"
