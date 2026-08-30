# As played by

An MEI customization. Defines how an MEI document carries, beside the score, a record of one or
more performances of it: which written note a sounded event realised, when it was struck, how long
and how loud.

The customization is [`odd/as-played-by.odd`](odd/as-played-by.odd), along with a RelaxNG grammar
and the Schematron rules compiled from it.

For an example encoding see [here](https://pfefferniels.github.io/as-played-by/).

## Encoding

A `<when>` in a `<recording>` takes one of five shapes, told apart by `@type` and by which of
`@data` and `@absolute` are present.

| `@type` | `@data` | `@absolute` | |
|---|---|---|---|
| `match` | yes | yes | a written note that sounded |
| `deletion` | yes | no | a written note that was not played |
| `insertion` | no | yes | a note that sounded without being written |
| `substitution` | yes | yes | a written note that sounded at another pitch |
| `sustain`, `soft` | no | yes | a pedal press |

`@data` points at the `xml:id` of a written note. `@absolute` is the moment it sounded, in whole
milliseconds, with `@abstype="smil"`.

Everything else a record carries is an `<extData>` child, whose `@type` is drawn from a closed
list: `velocity`, `duration`, `pitch`, `writtenPitch`, `onsetTicks`, `durationTicks`, `confidence`,
`reading`, `resp`, `certainty`, `ornamentAnchor`, `ornamentAnchorFrom`,
`ornamentAnchorConfidence`, `ornamentAnchorConfidenceOf`, `ornamentSlot`. For further reference see
the [ODD](odd/as-played-by.odd).

## Layout

| | |
|---|---|
| `odd/` | the customization, and the RelaxNG and Schematron compiled from it |
| `examples/` | an invented file covering all five shapes, a real one, and a counter-example per rule under `invalid/` |
| `index.html` | the page, which renders `examples/traeumerei.mei` |
| `vendor/verovio/` | a committed WebAssembly build of the fork, so the page needs no build step |
| `tools/` | building the schemas, checking the examples, rebuilding the vendored verovio |

## Checking a document

`tools/validate.sh` runs the grammar and the rules over `examples/`, and asserts that everything
under `examples/invalid/` is rejected.

```
   tools/validate.sh
```

To check a document of your own, validate it against `odd/as-played-by.rng` and
`odd/as-played-by.sch`. Most XML editors do this from the two `<?xml-model?>` instructions that
`examples/shapes.mei` carries.

After changing the ODD, recompile it.

```
   tools/build-schema.sh
```

Both need `curl`, `unzip`, `xmllint` and `saxon` (`brew install saxon`).

## Disclosure

The schema, the examples, the page and the scripts were written by agentic AI (Claude Code).

## Licence

The ODD and the examples are published under the same terms as MEI itself. The vendored verovio
build under `vendor/verovio` comes from
[rism-digital/verovio](https://github.com/rism-digital/verovio) under LGPL-3.0-or-later.
