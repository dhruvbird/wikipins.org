#! /usr/bin/awk

# Run on enallhits.tsv
#
# Merge adgacent entries and add up their counts. Input lines are TAB
# separated and terminated by a newline.

BEGIN { FS="\t"; C=0; T=""; } {
  if (T==tolower($2)) {
      C=$1;
  } else {
    if (T!="") {
      print C"\t"T;
    }
    T=tolower($2); C=$1;
  }
} END { if (T!="") print C" "T; }
