#!/bin/bash
# Runs the tests in InDesign and prints the result.
DIR="$(cd "$(dirname "$0")" && pwd)"
# ExtendScript misreads non-ASCII characters in string literals: use \uXXXX escapes there
if perl -ne 'if (/"[^"]*[^\x00-\x7F][^"]*"/) { print "$ARGV:$.: $_"; $bad = 1 } close ARGV if eof; END { exit !$bad }' "$DIR/../SwatchesRotator.jsx" "$DIR"/*.jsx; then
  echo "Non-ASCII characters in string literals (see above) - please write them as \\uXXXX"; exit 1
fi
mkdir -p "$DIR/output"
rm -f "$DIR/output/result.txt"
osascript -e 'with timeout of 600 seconds' \
  -e "tell application \"Adobe InDesign 2026\" to do script (POSIX file \"$DIR/run_tests.jsx\") language javascript" \
  -e 'end timeout' >/dev/null || exit 1
[ -f "$DIR/output/result.txt" ] || { echo "No result file"; exit 1; }
cat "$DIR/output/result.txt"
grep -q "RESULT: [0-9]* ok, 0 failed" "$DIR/output/result.txt"
