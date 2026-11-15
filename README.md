# As played by

MEI customization defining how an MEI document carries, beside the score, a record of one or
more performances of it: which written note a sounded event realised, when it was struck, how long
and how loud.

The customization is [`odd/as-played-by.odd`](odd/as-played-by.odd), along with a RelaxNG grammar
and the Schematron rules compiled from it.

For an example encoding see [here](https://pfefferniels.github.io/as-played-by/).

## Encoding

A `<when>` in a `<recording>` is a note that sounded or a pedal press, told apart by `@type`.

| `@type` | `@data` | `@absolute` | |
|---|---|---|---|
| `match` | yes | yes | a written note that sounded |
| `sustain`, `soft` | no | yes | a pedal press, with or without its travel |

`@data` points at the `xml:id` of a written note. `@absolute` is the moment it sounded, in whole
milliseconds, with `@abstype="smil"`.

There is no record of a note that sounded without being written, of a written note that was not
played, or of one played at another pitch. Such a difference is written into the score, as a
reading beside the one the source has, and the recording points at the notes of that reading. A
written note that no `<when>` points at was not played.

Where several `<when>` elements of a recording point at the same note, that note was played as an
ornament. Each of them states the pitch that sounded in `<extData type="pitch">`, their order is
the order of `@absolute`, and the written note falls where the earliest of them does. A `<when>`
that is alone on its note states no pitch.

Everything else a record carries is an `<extData>` child, whose `@type` is drawn from a closed
list: `velocity`, `duration`, `pitch`, `onsetTicks`, `durationTicks`, `travel`. For further
reference see the [ODD](odd/as-played-by.odd).

A pedal press may carry its `travel`: pairs `ms:position`, the milliseconds counted from
`@absolute`, the position from 0 (up) to 1 (down), ascending in time. With a travel, `@absolute` is
where the pedal left rest and `duration` runs until it returned there. Without one, the press is a
switch and `@absolute` is the moment it was pressed.

## Checking a document

To check a document of your own, validate it against `odd/as-played-by.rng` and
`odd/as-played-by.sch`. Most XML editors do this from the two `<?xml-model?>` instructions that
`examples/shapes.mei` carries.

To recompile the ODD after changing it:

```
   tools/build-schema.sh
```

It needs `curl`, `unzip`, `xmllint` and `saxon` (`brew install saxon`).

## Disclosure

The schema, the examples, the page and the scripts were written by agentic AI (Claude Code).

## Licence

The ODD and the examples are published under the same terms as MEI itself. The vendored verovio
build under `vendor/verovio` comes from
[rism-digital/verovio](https://github.com/rism-digital/verovio) under LGPL-3.0-or-later.
