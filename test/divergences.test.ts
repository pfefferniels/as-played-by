// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  divergencesOf,
  type AddedDivergence,
  type MissingDivergence,
  type ReplacedDivergence,
} from '../src/alignment/divergences'
import { defaultAction } from '../src/ui/divergenceReadings'
import type { OrnamentSign } from '../src/mei/ornamentSigns'
import type { NoteSpan } from '../src/performance/midiSpans'
import type { ScoreNote } from '../src/score/scoreNotes'

const scoreNote = (note: string, onset: number, pitch: number): ScoreNote => ({
  note,
  onset,
  duration: 1,
  pitch,
})

const span = (id: string, onsetMs: number, pitch: number): NoteSpan => ({
  type: 'note',
  id,
  onset: onsetMs,
  offset: onsetMs + 100,
  onsetMs,
  offsetMs: onsetMs + 100,
  pitch,
  velocity: 64,
  channel: 0,
})

const trill: OrnamentSign = { name: 'trill', id: 'tr1', form: null }

/**
 * A small alignment: two written notes, both played, plus whatever extra played
 * notes and unplayed written notes a case needs.
 */
const build = (opts: {
  scoreNotes?: ScoreNote[]
  spans?: NoteSpan[]
  matches?: { scoreId: string; performanceId: string }[]
  insertions?: string[]
  deletions?: string[]
  signs?: [string, OrnamentSign[]][]
  hasRepeats?: boolean
}) => {
  const scoreNotes = opts.scoreNotes ?? [scoreNote('n1', 0, 60), scoreNote('n2', 4, 67)]
  const spans = opts.spans ?? [span('p1', 0, 60), span('p2', 2000, 67)]
  const matches = opts.matches ?? [
    { scoreId: 'n1', performanceId: 'p1' },
    { scoreId: 'n2', performanceId: 'p2' },
  ]

  return divergencesOf(
    {
      matches: matches.map((m) => ({ ...m, confidence: 0.9 })),
      deletions: (opts.deletions ?? []).map((scoreId) => ({ scoreId, confidence: 0.5 })),
      insertions: (opts.insertions ?? []).map((performanceId) => ({
        performanceId,
        confidence: 0.5,
      })),
      scoreNotes,
      spans,
      signs: new Map(opts.signs ?? []),
    },
    { hasRepeats: opts.hasRepeats }
  )
}

const addedOnes = (all: ReturnType<typeof build>) =>
  all.filter((d): d is AddedDivergence => d.kind === 'added')
const missingOnes = (all: ReturnType<typeof build>) =>
  all.filter((d): d is MissingDivergence => d.kind === 'missing')

describe('played notes with no note in the score', () => {
  it('reads a run against a note the score puts a trill on as that trill, performed', () => {
    const extra = [span('x1', 100, 62), span('x2', 200, 60), span('x3', 300, 62)]
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), ...extra],
      insertions: ['x1', 'x2', 'x3'],
      signs: [['n1', [trill]]],
    })

    const added = addedOnes(all)
    expect(added).toHaveLength(1)
    expect(added[0].reading).toBe('written-ornament')
    expect(added[0].anchorId).toBe('n1')
    expect(added[0].perfIds).toEqual(['x1', 'x2', 'x3'])
    expect(added[0].because).toContain('trill')
  })

  it('reads the same run as ornamentation where the score writes no sign', () => {
    const extra = [span('x1', 100, 62), span('x2', 200, 60), span('x3', 300, 62)]
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), ...extra],
      insertions: ['x1', 'x2', 'x3'],
    })

    const added = addedOnes(all)
    expect(added).toHaveLength(1)
    expect(added[0].reading).toBe('ornamentation')
    expect(added[0].anchorId).toBe('n1')
  })

  it('keeps one figure together and starts a new one after a silence', () => {
    const extra = [
      span('x1', 100, 62),
      span('x2', 200, 60),
      span('x3', 300, 62),
      // a full second later, and so not part of the same gesture
      span('x4', 1300, 61),
    ]
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), ...extra],
      insertions: ['x1', 'x2', 'x3', 'x4'],
    })

    const added = addedOnes(all)
    expect(added).toHaveLength(2)
    expect(added[0].perfIds).toEqual(['x1', 'x2', 'x3'])
    expect(added[1].perfIds).toEqual(['x4'])
  })

  it('reads a note struck with a written one an octave away as a doubled octave', () => {
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 10, 48)],
      insertions: ['x1'],
    })

    const added = addedOnes(all)
    expect(added[0].reading).toBe('added-octave')
    expect(added[0].because).toContain('below')
  })

  it('reads another tone struck with a written note as a fuller chord', () => {
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 10, 64)],
      insertions: ['x1'],
    })

    expect(addedOnes(all)[0].reading).toBe('fuller-chord')
  })

  it('reads a lone note between written ones as an added note', () => {
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 55)],
      insertions: ['x1'],
    })

    expect(addedOnes(all)[0].reading).toBe('added-note')
  })

  it('does not call a note played before the music starts an addition to it', () => {
    const all = build({
      spans: [span('p1', 1000, 60), span('p2', 3000, 67), span('x1', 10, 30)],
      insertions: ['x1'],
      matches: [
        { scoreId: 'n1', performanceId: 'p1' },
        { scoreId: 'n2', performanceId: 'p2' },
      ],
    })

    expect(addedOnes(all)[0].reading).toBe('outside')
  })

  it('blames the engraving, not the performer, where the repeats are not written out', () => {
    const all = build({
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 55)],
      insertions: ['x1'],
      hasRepeats: true,
    })

    expect(addedOnes(all)[0].reading).toBe('repeat-pass')
  })
})

describe('written notes the recording never played', () => {
  it('reads a note whose moment was otherwise played as a thinned chord', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('n1b', 0, 64), scoreNote('n2', 4, 67)],
      deletions: ['n1b'],
    })

    const missing = missingOnes(all)
    expect(missing).toHaveLength(1)
    expect(missing[0].reading).toBe('thinned-chord')
    expect(missing[0].scoreIds).toEqual(['n1b'])
  })

  it('gathers a stretch the recording passes over into one omitted passage', () => {
    const all = build({
      scoreNotes: [
        scoreNote('n1', 0, 60),
        scoreNote('a', 1, 62),
        scoreNote('b', 2, 64),
        scoreNote('c', 3, 65),
        scoreNote('n2', 4, 67),
      ],
      deletions: ['a', 'b', 'c'],
    })

    const missing = missingOnes(all)
    expect(missing).toHaveLength(1)
    expect(missing[0].reading).toBe('omitted-passage')
    expect(missing[0].scoreIds).toEqual(['a', 'b', 'c'])
  })

  it('reads a single unplayed note on its own as an omitted note', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 62), scoreNote('n2', 4, 67)],
      deletions: ['a'],
    })

    expect(missingOnes(all)[0].reading).toBe('omitted-note')
  })

  it('does not call a note beyond the recording’s reach one the performer left out', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('n2', 4, 67), scoreNote('late', 99, 72)],
      deletions: ['late'],
    })

    expect(missingOnes(all)[0].reading).toBe('outside')
  })
})

const replacedOnes = (all: ReturnType<typeof build>) =>
  all.filter((d): d is ReplacedDivergence => d.kind === 'replaced')

/**
 * The default alignment is a metronome: n1 at score onset 0 was played at 0 ms,
 * n2 at onset 4 at 2000 ms, so a written note at onset 2 was due at 1000 ms.
 */
describe('a written note and the played note that stood in for it', () => {
  it('pairs a deletion and an insertion at the same moment into one substitution', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1010, 65)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    expect(addedOnes(all)).toHaveLength(0)
    expect(missingOnes(all)).toHaveLength(0)

    const replaced = replacedOnes(all)
    expect(replaced).toHaveLength(1)
    expect(replaced[0].scoreId).toBe('a')
    expect(replaced[0].perfId).toBe('x1')
    expect(replaced[0].pitches).toEqual([64, 65])
    expect(replaced[0].reading).toBe('neighbour-slip')
  })

  it('reads the written note struck an octave off as the note itself, displaced', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 52)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    const replaced = replacedOnes(all)
    expect(replaced[0].reading).toBe('octave-displaced')
    expect(replaced[0].because).toContain('an octave lower')
  })

  it('reads the very same pitch at the very same moment as a match the aligner missed', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 64)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    const replaced = replacedOnes(all)
    expect(replaced[0].reading).toBe('unmatched-pair')
    // Which is the one family whose first offer is to mend the alignment
    expect(defaultAction(replaced[0])).toBe('count-as-played')
  })

  it('reads a note far from the written one, at its moment, as a different note', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 71)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    expect(replacedOnes(all)[0].reading).toBe('different-note')
  })

  it('prefers a substitution to a chord thinned and filled out at the same instant', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('n1b', 0, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 5, 65)],
      deletions: ['n1b'],
      insertions: ['x1'],
    })

    expect(replacedOnes(all)).toHaveLength(1)
    expect(missingOnes(all)).toHaveLength(0)
    expect(addedOnes(all)).toHaveLength(0)
  })

  it('leaves a played note too far from the written note’s moment alone', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1400, 65)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    expect(replacedOnes(all)).toHaveLength(0)
    expect(missingOnes(all)).toHaveLength(1)
    expect(addedOnes(all)).toHaveLength(1)
  })

  it('leaves a played note further than an octave from the written one alone', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('a', 2, 64), scoreNote('n2', 4, 67)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 1000, 50)],
      deletions: ['a'],
      insertions: ['x1'],
    })

    expect(replacedOnes(all)).toHaveLength(0)
    expect(missingOnes(all)).toHaveLength(1)
  })

  it('does not read a passage played differently as a run of single substitutions', () => {
    const all = build({
      scoreNotes: [
        scoreNote('n1', 0, 60),
        scoreNote('a', 1, 62),
        scoreNote('b', 2, 64),
        scoreNote('n2', 4, 67),
      ],
      spans: [
        span('p1', 0, 60),
        span('p2', 2000, 67),
        span('x1', 500, 63),
        span('x2', 1000, 65),
      ],
      deletions: ['a', 'b'],
      insertions: ['x1', 'x2'],
    })

    expect(replacedOnes(all)).toHaveLength(0)
    expect(missingOnes(all)).toHaveLength(1)
    expect(addedOnes(all)).toHaveLength(2)
  })

  it('gives one played note to one written note, and takes the nearer reading first', () => {
    const all = build({
      // Two unplayed notes close enough that either could claim the played one:
      // the chord tone due at 0 ms, and `a` due at 100 ms. They stay separate
      // groups because one thins a chord that was otherwise played and the other
      // does not.
      scoreNotes: [
        scoreNote('n1', 0, 60),
        scoreNote('chordTone', 0, 64),
        scoreNote('a', 0.2, 65),
        scoreNote('n2', 4, 67),
      ],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 90, 65)],
      deletions: ['chordTone', 'a'],
      insertions: ['x1'],
    })

    const replaced = replacedOnes(all)
    expect(replaced).toHaveLength(1)
    expect(replaced[0].scoreId).toBe('a')
    expect(missingOnes(all).flatMap((d) => d.scoreIds)).toEqual(['chordTone'])
  })

  it('will not pair beyond where the matched notes reach', () => {
    const all = build({
      scoreNotes: [scoreNote('n1', 0, 60), scoreNote('n2', 4, 67), scoreNote('late', 6, 72)],
      spans: [span('p1', 0, 60), span('p2', 2000, 67), span('x1', 3000, 71)],
      deletions: ['late'],
      insertions: ['x1'],
    })

    expect(replacedOnes(all)).toHaveLength(0)
  })
})
