#! /usr/bin/awk

# Merge adgacent entries and add up their counts. Input lines are TAB
# separated and terminated by a newline.

BEGIN { FS="\t"; T=""; C=0; } {
  if (T==tolower($1)) {
    C=C+$2
  } else {
    if (T!="") {
      print T"\t"C;
    }
    T=tolower($1); C=$2;
  }
} END { if (T!="") print T" "C; }
