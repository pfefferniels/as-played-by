# As Played By

*As played by* is an MEI customization aimed at providing
a standardized way to align a score with a performance purely
within MEI. It also includes a tool to generate these MEI files.

## Rendering

A performance is rendered by verovio itself: the `<performance>` element of the
MEI is read as a set of `<recording>`s, and the score is laid out along the time
one of them was played in, rather than along the notated durations. Notes stand
where they were struck, the ink density of a notehead is the velocity it was
played with, barlines are drawn dashed because they no longer sit at a fixed
place, and a ruler of the performed time runs below every system.

That is not part of verovio upstream. The build carrying it is committed under
[`vendor/verovio`](vendor/verovio/README.md) and used as the `verovio` package,
so nothing else is needed to run or build this project. After changing the fork:

```
   npm run verovio:build
```

Everything the renderer offers is a verovio option (`performanceAlignment`,
`performanceScale`, `performanceRecording`, ...); `src/verovio/toolkit.ts` holds
the defaults and `<PerformedScore>` is the one component that draws a score.

## Layout

`src/` is grouped by what a module works on, not by what kind of file it is:

| | |
|---|---|
| `score/` | An MEI document read as notes. `scoreNotes.ts` is the entry point every aligner starts from; `accidentals.ts` and `notatedOnsets.ts` correct what verovio reports. |
| `performance/` | A MIDI recording read as sounding spans (`midiSpans.ts`), plus pitch naming and spelling. |
| `alignment/` | Matching the two. `types.ts` holds the `Match` both aligners produce, `naiveAligner.ts` is the heuristic one, `mlign/` the model, and `applyAlignment.ts` writes the result into the MEI. |
| `mei/` | Writing back: `<when>`, `<recording>`, pedals, metadata. |
| `verovio/` | The vendored fork and the one component that draws a score. |
| `ui/` | The three views (`/`, `/editor`, `/mlign`) and the widgets they share. |

Modules are `camelCase`; `PascalCase` means a React component.

## How to run?

```
   npm run dev
```

`/` shows the transcription in `public/`, `/editor` aligns an MEI against a MIDI
recording and writes the `<when>` elements of the alignment back into it.
