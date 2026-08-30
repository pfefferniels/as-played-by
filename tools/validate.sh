#!/usr/bin/env bash
#
# Checks the examples against the committed schemas: everything in examples/
# must pass both the grammar and the rules, and everything in examples/invalid/
# must be rejected by at least one of them. The second half is the point. A
# schema that accepts everything would pass the first half.
#
# Needs curl, unzip, xmllint and saxon (brew install saxon).
set -euo pipefail

SCHEMATRON_VERSION=${SCHEMATRON_VERSION:-2020-10-01}

HERE=$(cd "$(dirname "$0")/.." && pwd)
CACHE="$HERE/.build"
RNG="$HERE/odd/as-played-by.rng"
SCH="$HERE/odd/as-played-by.sch"

for tool in curl unzip xmllint saxon; do
    command -v "$tool" >/dev/null || { echo "$tool is not on the PATH" >&2; exit 1; }
done
for f in "$RNG" "$SCH"; do
    [ -f "$f" ] || { echo "$f is missing; run tools/build-schema.sh" >&2; exit 1; }
done

mkdir -p "$CACHE"

isosch="$CACHE/iso-schematron"
if [ ! -d "$isosch" ]; then
    curl -sSLo "$CACHE/iso-schematron.zip" \
        "https://github.com/Schematron/schematron/releases/download/$SCHEMATRON_VERSION/iso-schematron-xslt2.zip"
    unzip -q -o "$CACHE/iso-schematron.zip" -d "$isosch"
fi

# Schematron rules are run by compiling them into a stylesheet that reports
# what failed, which is the three-step pipeline the standard prescribes.
rules="$CACHE/rules.xsl"
if [ ! -f "$rules" ] || [ "$SCH" -nt "$rules" ]; then
    saxon -s:"$SCH" -xsl:"$isosch/iso_dsdl_include.xsl" -o:"$CACHE/sch-included.xml"
    saxon -s:"$CACHE/sch-included.xml" -xsl:"$isosch/iso_abstract_expand.xsl" -o:"$CACHE/sch-expanded.xml"
    saxon -s:"$CACHE/sch-expanded.xml" -xsl:"$isosch/iso_svrl_for_xslt2.xsl" -o:"$rules"
fi

# Prints one line per broken rule, and nothing at all when the file is clean.
report_failures() {
    saxon -s:"$1" -xsl:"$rules" -o:"$CACHE/report.svrl" >/dev/null 2>&1
    python3 - "$CACHE/report.svrl" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
for block in re.findall(r"<svrl:failed-assert.*?</svrl:failed-assert>", text, re.S):
    print("      " + " ".join(re.sub(r"<[^>]+>", "", block).split()))
PY
}

grammar_errors() {
    xmllint --noout --relaxng "$RNG" "$1" 2>&1 | grep -v "validates$" || true
}

failures=0

echo "examples/ — these must be accepted"
for file in "$HERE"/examples/*.mei; do
    name=$(basename "$file")
    grammar=$(grammar_errors "$file")
    rules_broken=$(report_failures "$file")
    if [ -n "$grammar" ] || [ -n "$rules_broken" ]; then
        echo "  REJECTED  $name"
        [ -n "$grammar" ] && echo "$grammar" | sed 's/^/      /'
        [ -n "$rules_broken" ] && echo "$rules_broken"
        failures=$((failures + 1))
    else
        echo "  ok        $name"
    fi
done

echo
echo "examples/invalid/ — these must be rejected"
for file in "$HERE"/examples/invalid/*.mei; do
    name=$(basename "$file")
    grammar=$(grammar_errors "$file")
    rules_broken=$(report_failures "$file")
    if [ -z "$grammar" ] && [ -z "$rules_broken" ]; then
        echo "  ACCEPTED  $name"
        failures=$((failures + 1))
    else
        echo "  ok        $name"
        [ -n "$rules_broken" ] && echo "$rules_broken"
    fi
done

echo
if [ "$failures" -ne 0 ]; then
    echo "$failures example(s) did not behave as they should."
    exit 1
fi
echo "Every example behaved as it should."
