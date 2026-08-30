#!/usr/bin/env bash
#
# Compiles odd/as-played-by.odd into the RelaxNG grammar and the Schematron
# rules beside it. Both are committed, so this only needs to run after the ODD
# changes; nothing that reads or writes the format needs this toolchain.
#
# Needs curl, unzip, xmllint and saxon (brew install saxon).
set -euo pipefail

MEI_VERSION=${MEI_VERSION:-5.1}
TEI_STYLESHEETS_VERSION=${TEI_STYLESHEETS_VERSION:-7.61.0}

HERE=$(cd "$(dirname "$0")/.." && pwd)
CACHE="$HERE/.build"
ODD="$HERE/odd/as-played-by.odd"

for tool in curl unzip xmllint saxon; do
    command -v "$tool" >/dev/null || { echo "$tool is not on the PATH" >&2; exit 1; }
done

mkdir -p "$CACHE"

mei="$CACHE/music-encoding-$MEI_VERSION"
if [ ! -d "$mei" ]; then
    echo "Fetching MEI $MEI_VERSION..."
    curl -sSLo "$CACHE/mei.tar.gz" \
        "https://github.com/music-encoding/music-encoding/archive/refs/tags/v$MEI_VERSION.tar.gz"
    tar xzf "$CACHE/mei.tar.gz" -C "$CACHE"
fi

tei="$CACHE/tei-$TEI_STYLESHEETS_VERSION"
if [ ! -d "$tei" ]; then
    echo "Fetching the TEI stylesheets $TEI_STYLESHEETS_VERSION..."
    curl -sSLo "$CACHE/tei-xsl.zip" \
        "https://github.com/TEIC/Stylesheets/releases/download/v$TEI_STYLESHEETS_VERSION/tei-xsl-$TEI_STYLESHEETS_VERSION.zip"
    unzip -q -o "$CACHE/tei-xsl.zip" -d "$tei"
fi
odds="$tei/xml/tei/stylesheet/odds"

# The MEI source ODD is spread over one file per module and pulled together by
# XInclude. Saxon's own resolver does not follow the xpointers the guidelines
# use, so the includes are resolved with xmllint first.
source_odd="$CACHE/mei-source-canonical.xml"
if [ ! -f "$source_odd" ]; then
    echo "Canonicalizing the MEI source ODD..."
    (cd "$mei/source" && xmllint --xinclude mei-source.xml) > "$CACHE/mei-source-xincluded.xml"
    saxon -s:"$CACHE/mei-source-xincluded.xml" \
        -xsl:"$mei/utils/canonicalization/copy.xsl" \
        -o:"$source_odd"
fi

echo "Compiling the ODD against MEI $MEI_VERSION..."
saxon -s:"$ODD" -xsl:"$odds/odd2odd.xsl" \
    -o:"$CACHE/as-played-by_compiled.odd" \
    defaultSource="$source_odd"

echo "Writing odd/as-played-by.rng..."
saxon -s:"$CACHE/as-played-by_compiled.odd" -xsl:"$odds/odd2relax.xsl" \
    -o:"$HERE/odd/as-played-by.rng"

echo "Writing odd/as-played-by.sch..."
saxon -s:"$CACHE/as-played-by_compiled.odd" -xsl:"$odds/extract-isosch.xsl" \
    -o:"$HERE/odd/as-played-by.sch"

echo "Done. Run tools/validate.sh to check the examples against them."
