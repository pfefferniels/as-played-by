# Score fixtures from real repertoire

Three short excerpts of published piano music, converted to MEI by the vendored
verovio, kept here because the two MEI files the repository already had contain
no grace note, no arpeggio and no ornament at all. Between them they hold every
construct that makes verovio's played onsets differ from the onsets the score
writes, so `getNotesFromMEI` and `applyNotatedOnsets` can be pinned against
music rather than against a hand-built probe.

Each fixture ships as a pair: the MusicXML the excerpt was cut from, and the MEI
verovio made of it. The MusicXML is here so the MEI can be re-derived and so the
note table can be checked against partitura, which reads the same source.

## Provenance

| fixture | source | measures |
| --- | --- | --- |
| `chopin-op38-mm18-22` | Chopin, Ballade op. 38 — Vienna 4x22 corpus, `musicxml/Chopin_op38.musicxml` | 18–22 |
| `chopin-op38-mm40-46` | same | 40–46 |
| `mozart-kv279-mm30-35` | Mozart, Sonata K. 279/i — Batik plays Mozart, `scores/kv279_1.musicxml` | 30–35 |

Converted with the vendored verovio, `6.4.0-aligned-mei`, built from fork commit
`7e8d5ce` (`vendor/verovio/build-info.json`):

```js
const toolkit = new VerovioToolkit(await createVerovioModule())
toolkit.loadData(musicXml)                       // verovio imports MusicXML
writeFileSync(out, toolkit.getMEI({ pageNo: 0, scoreBased: true }))
```

Cutting an excerpt carries the `<attributes>` and the `<sound tempo>` in force at
the first kept measure into it, and drops the half of any slur or wedge whose
partner fell outside the cut. Without the tempo verovio falls back to 120 bpm,
which changes how much time it gives a grace note.

The two Chopin excerpts have one `<staves>2</staves>` added to the carried
`<attributes>`. The Vienna 4x22 Chopin sources declare two clefs and put
`staff="2"` on notes but never say how many staves the part has, so verovio
folds the whole piano texture onto one staff and emits 83 warnings over the full
piece. Adding the element silences every warning and leaves the note table
bit-identical — same ids, onsets, durations and pitches in both `notatedOnsets`
modes. Nothing else in any excerpt was edited.

## What is in them

All three are well-formed, every `xml:id` is a valid NCName, and no id repeats.

| | mm18-22 | mm40-46 | kv279 |
| --- | --- | --- | --- |
| measures / staves | 5 / 2 | 7 / 2 | 6 / 2 |
| `<note>` | 87 | 119 | 146 |
| `<chord>` | 1 | 1 | 6 |
| grace notes (`@grace`) | 2 (`unacc`) | 8 (1 `unacc`, 7 `acc`) | 2 (`acc`) |
| `<tie>` | 1 | 6 | 0 |
| ties starting on a grace | 0 | 6 | 0 |
| `<arpeg>` (all with `@plist`) | 0 | 0 | 2 |
| `<trill>` | 0 | 0 | 1 |
| `<slur>` | 3 | 3 | 10 |
| rows from `getNotesFromMEI` | 86 | 113 | 146 |

The round trip is lossless for all of it: MusicXML and MEI hold the same number
of notes, graces, ties, arpeggios and trills, and every note keeps the `id="nN"`
the MusicXML gave it, so the table joins to partitura's note array note by note.

## The behaviour each one pins

Measured against `ScoreTable.from_musicxml` on the same source, matched on id.

**`mozart-kv279-mm30-35`** — what `notatedOnsets: true` is for. Both arpeggios
are rolled by verovio and both grace notes push their principal aside; the
correction puts all of them back. Arpeggio members agreeing with partitura go
from 2/6 to 6/6, the one grace principal from 0/1 to 1/1, and nothing that was
right becomes wrong. All 137 plain notes agree in both modes.

**`chopin-op38-mm40-46`** — the acciaccatura chain that closes the piece, six
graces each tied into a sustained principal, plus one `unacc` grace in m. 41.

- m. 41 is the good case: the grace displaces its principal, and the correction
  hands it back exactly — onset 3.035 → 3.0 and duration 0.715 → 0.75, both
  partitura's numbers.
- m. 46 is the case no correction touches. Verovio does *not* merge the tie:
  each `*main` note sounds from the notated 18.0 to 21.0 while its grace sounds
  after it, at 18.035 … 18.211. `getNotesFromMEI` drops every note that is a tie
  `@endid`, so the six principals are thrown away and the table keeps six graces
  of 0.035 quarters each. partitura reads the same six notes as onset 18.0,
  duration 3.0. `notatedOnsets: true` changes none of it.

**`chopin-op38-mm18-22`** — the case `notatedOnsets: true` makes worse. Both
graces here are `unacc` with a note before them in the same layer, so verovio
lays them over the tail of that note and leaves the principal where the score
writes it. `restoreGracePrincipals` moves the principal back to the grace's
onset all the same, taking two notes that agreed with partitura (4.5 and 10.5)
away from it (4.465 and 10.465).
