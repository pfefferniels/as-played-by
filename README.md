# As played by

An MEI customization for recording how a score was played. Beside the notation, a document carries
one or more performances of it: which written note each sounded event realised, when it was struck,
how loud it was, and where the two disagreed. The record lives in `<performance>` and travels with
the score, so an alignment does not need a second file or a second format.

The customization is [`odd/as-played-by.odd`](odd/as-played-by.odd). The RelaxNG grammar and the
Schematron rules compiled from it sit beside it and are committed, so nothing that reads or writes
the format needs a schema toolchain.

There is a [page showing what it is for](https://align.encoded-ghosts.org/): the same music drawn
twice, once by notated duration and once by the times a performance took.

## Why write it down

Two independent readers have to agree on such a file. The
[MPM Desk](https://github.com/pfefferniels/mpm-desk) reads an alignment back in order to fit
performance instructions to it, and the [verovio fork](https://github.com/pfefferniels/verovio) on
branch `aligned-mei` lays a score out along performed time. Until now the agreement between them
existed only as two source files that happened to match. Where they read the same attribute
differently, this customization writes down the narrower reading.

The repository held the alignment desk that produced these files. That work has moved into the MPM
Desk, and what is left here is the format.

## The five shapes

A `<when>` in a `<recording>` takes one of five shapes, told apart by `@type` and by which of
`@data` and `@absolute` are present.

| `@type` | `@data` | `@absolute` | |
|---|---|---|---|
| `match` | yes | yes | a written note that sounded |
| `deletion` | yes | no | a written note that was not played |
| `insertion` | no | yes | a note that sounded without being written |
| `substitution` | yes | yes | a written note that sounded at another pitch |
| `sustain`, `soft` | no | yes | a pedal press |

`@data` points at the written note. `@absolute` is the moment it sounded, in whole milliseconds,
with `@abstype="smil"`. `@corresp` names the event in the source recording, in whatever identifiers
that recording uses; it is optional and deliberately not a reference into the MEI document.

Everything else a record carries is an `<extData>` child, whose `@type` is drawn from a closed
list: `velocity`, `duration`, `pitch`, `writtenPitch`, `onsetTicks`, `durationTicks`, `confidence`,
`reading`, `resp`, `certainty`, `ornamentAnchor`, `ornamentAnchorFrom`,
`ornamentAnchorConfidence`, `ornamentAnchorConfidenceOf`, `ornamentSlot`. The ODD says what each
one holds. [`examples/shapes.mei`](examples/shapes.mei) shows all five shapes in eight bars' worth
of alignment.

## What it changes about MEI

Almost nothing needs adding. `<when>` already takes `<extData>` children in MEI 5.1, and `@type`
and `@corresp` reach it through `att.common`. One attribute is genuinely missing: `<recording>` is
not a member of `att.source`, so it cannot name the take it records, which is how a document
holding several takes says which one a `<when>` belongs to and how verovio's `performanceRecording`
selects one. The customization adds that membership. Whether this is the right way round is an open
question, and asking the MEI community to put `<recording>` into `att.source` would remove the need
for a customization at this point altogether.

The rest only narrows what MEI already allows. The sharpest narrowing is `@absolute`: MEI permits
several time formats and the verovio fork reads `ms`, `s` and `min`, but the MPM Desk reads the
attribute with `parseInt` and would take `12.5s` for twelve milliseconds. Only the form both read
alike is allowed here.

## Two things that are easy to get wrong

An `xml:id` is an NCName and may not begin with a digit, so a bare UUID fails roughly half the
time. Prefixing generated identifiers is enough.

`<performance>` is a member of `model.resourceLike`, which `<music>` admits only *before* `<front>`
and `<body>`. Appending it to `<music>`, which is the obvious way to write it, puts it where MEI
does not allow it.

Both are in [`examples/invalid/`](examples/invalid), together with a counter-example for every rule
the customization states.

## Rough edges

The verovio fork warns on markup this format considers correct. A deletion reaches it as a `<when>`
with no `@absolute` and is reported as "Skipping `<when>` without an @absolute attribute", and an
XML comment inside a `<recording>` is reported as an unsupported element. Neither changes what is
drawn, and both should be fixed in the fork rather than worked around here.

[`demo/transcription.mei`](demo/transcription.mei) is a real two-take alignment of piano rolls,
made in the MPM Desk before this customization existed and migrated to it. It satisfies every rule
stated here and is still rejected by MEI's own rules, because two hairpins in the imported score
have no end. That is a defect in the score rather than in the alignment, so the file is kept out of
the conformance corpus rather than silently repaired.

## Layout

| | |
|---|---|
| `odd/` | the customization, and the RelaxNG and Schematron compiled from it |
| `examples/` | one file per shape, and a counter-example per rule under `invalid/` |
| `demo/` | the file the page renders |
| `index.html` | the page |
| `vendor/verovio/` | a committed WebAssembly build of the fork, so the page needs no build step |
| `tools/` | the three scripts below |

## Checking a document

`tools/validate.sh` runs the grammar and the rules over `examples/`, and asserts that everything
under `examples/invalid/` is rejected. The second half is the point, since a schema that accepts
everything would pass the first.

```
   tools/validate.sh
```

To check a document of your own, validate it against `odd/as-played-by.rng` and
`odd/as-played-by.sch`. Most XML editors do this from the two `<?xml-model?>` instructions that
`examples/shapes.mei` carries.

After changing the ODD, recompile it. The script fetches MEI 5.1 and the TEI stylesheets into an
ignored `.build/`, so the first run takes a while.

```
   tools/build-schema.sh
```

Both need `curl`, `unzip`, `xmllint` and `saxon` (`brew install saxon`).

`tools/build-verovio.sh` rebuilds the vendored toolkit, which is only needed after the fork
changes. It wants the fork checked out and the Emscripten SDK; see the script for the paths.

## Licence

The ODD and the examples are published under the same terms as MEI itself. The vendored verovio
build under `vendor/verovio` keeps its own: it comes from
[rism-digital/verovio](https://github.com/rism-digital/verovio) under LGPL-3.0-or-later.
