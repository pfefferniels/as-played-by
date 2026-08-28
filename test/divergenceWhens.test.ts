// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { MidiFile } from 'midifile-ts'
import { applyAlignment } from '../src/alignment/applyAlignment'
import { parseRecordings } from '../src/mei/parseRecordings'
import { buildMidiFile } from '../src/performance/buildMidiFile'
import { asSpans, type NoteSpan } from '../src/performance/midiSpans'
import { loadVerovio, renderPerformance } from '../src/verovio/toolkit'
import type { Divergence } from '../src/alignment/divergences'
import type { VerovioToolkit } from 'verovio/esm'

const mei = readFileSync(join(__dirname, '..', 'public', 'transcription.mei'), 'utf-8')

let midi: MidiFile
let spans: NoteSpan[]
let scoreId: string
let otherScoreId: string

beforeAll(() => {
  const { recordings, pitchMap } = parseRecordings(mei)
  midi = buildMidiFile(recordings[0], pitchMap)
  spans = asSpans(midi, true).filter((s): s is NoteSpan => s.type === 'note')

  const ids = [...recordings[0].noteSpans.keys()]
  scoreId = ids[0]
  otherScoreId = ids[1]
})

const added = (perfIds: string[], anchorId: string | null): Divergence => ({
  kind: 'added',
  id: 'added-0',
  perfIds,
  pitches: perfIds.map(() => 60),
  anchorId,
  signs: [],
  reading: 'written-ornament',
  because: 'the score writes a trill here',
  onsetMs: 0,
  confidence: 0.42,
})

/**
 * The divergences of whichever recording holds them.
 *
 * `insertRecording` appends into the first <performance>, and transcription.mei
 * has more than one, so the recording just written is not the last in the
 * document - looking there finds nothing.
 */
const divergencesIn = (doc: string) =>
  parseRecordings(doc).recordings.flatMap((r) => r.divergences)

const missing = (scoreIds: string[]): Divergence => ({
  kind: 'missing',
  id: 'missing-0',
  scoreIds,
  reading: 'thinned-chord',
  because: 'the rest of the chord was played',
  onset: 0,
  confidence: 0.31,
})

describe('writing divergences into the recording', () => {
  it('gives a played note with no score note a <when> with no @data', () => {
    const result = applyAlignment(mei, midi, [], {
      divergences: [added([spans[0].id], scoreId)],
    })

    const doc = new DOMParser().parseFromString(result, 'application/xml')
    expect(doc.querySelector('parsererror')).toBeNull()

    const when = doc.querySelector('when[type="insertion"]')
    expect(when).not.toBeNull()
    expect(when!.hasAttribute('data')).toBe(false)
    expect(when!.getAttribute('absolute')).toBe(`${spans[0].onsetMs.toFixed(0)}ms`)
  })

  it('gives a written note that was never played a <when> with no @absolute', () => {
    const result = applyAlignment(mei, midi, [], { divergences: [missing([scoreId])] })

    const when = new DOMParser()
      .parseFromString(result, 'application/xml')
      .querySelector('when[type="deletion"]')

    expect(when).not.toBeNull()
    expect(when!.getAttribute('data')).toBe(`#${scoreId}`)
    expect(when!.hasAttribute('absolute')).toBe(false)
  })

  it('carries the ornament anchor under espressivo’s own name', () => {
    const result = applyAlignment(mei, midi, [], {
      divergences: [added([spans[0].id, spans[1].id], scoreId)],
    })

    const doc = new DOMParser().parseFromString(result, 'application/xml')
    const anchors = [...doc.querySelectorAll('extData[type="ornamentAnchor"]')]
    expect(anchors).toHaveLength(2)
    expect(anchors[0].textContent).toBe(`#${scoreId}`)

    // The slot numbers the note's place in the figure, as espressivo's does
    const slots = [...doc.querySelectorAll('extData[type="ornamentSlot"]')].map(
      (s) => s.textContent
    )
    expect(slots).toEqual(['0', '1'])
  })

  it('leaves out a deletion against a note the document does not hold', () => {
    const result = applyAlignment(mei, midi, [], { divergences: [missing(['no-such-note'])] })

    expect(result).not.toContain('no-such-note')
  })

  it('reads both shapes back out again', () => {
    const result = applyAlignment(mei, midi, [], {
      divergences: [added([spans[0].id], scoreId), missing([otherScoreId])],
    })

    const found = divergencesIn(result)

    const insertion = found.find((d) => d.kind === 'insertion')
    expect(insertion?.span?.pitch).toBe(spans[0].pitch)
    expect(insertion?.ornamentAnchor).toBe(scoreId)
    expect(insertion?.reading).toBe('written-ornament')
    expect(insertion?.confidence).toBeCloseTo(0.42, 3)

    const deletion = found.find((d) => d.kind === 'deletion')
    expect(deletion?.scoreId).toBe(otherScoreId)
    expect(deletion?.reading).toBe('thinned-chord')
  })

  it('records the reading the reader settled on rather than the proposed one', () => {
    const result = applyAlignment(mei, midi, [], {
      divergences: [added([spans[0].id], scoreId)],
      resolutions: new Map([
        ['added-0', { reading: 'added-octave', resp: 'NP', certainty: 'high' }],
      ]),
    })

    const insertion = divergencesIn(result)[0]

    expect(insertion.reading).toBe('added-octave')
    expect(insertion.resp).toBe('NP')
    expect(insertion.certainty).toBe('high')
  })
})

describe('the vendored fork, given those <when>s in the recording it lays out from', () => {
  let tk: VerovioToolkit

  beforeAll(async () => {
    tk = await loadVerovio()
  }, 60_000)

  /** Every notehead's x, keyed by the id verovio drew it under. */
  const noteheadXs = (doc: string) => {
    const pages = renderPerformance(tk, doc, { performanceRecording: '1' })
    const xs = new Map<string, number>()
    for (const page of pages) {
      const parsed = new DOMParser().parseFromString(page, 'text/html')
      for (const note of parsed.querySelectorAll('.note')) {
        const id = note.getAttribute('data-id')
        const t = note
          .querySelector('.notehead use')
          ?.getAttribute('transform')
          ?.match(/translate\(\s*([-0-9.]+)/)
        if (id && t) xs.set(id, Number(t[1]))
      }
    }
    return xs
  }

  // This is the licence for putting divergences in the very recording the score
  // is laid out from, rather than in a second one: the fork ignores a <when> it
  // cannot resolve, so nothing moves.
  it('draws every notehead in exactly the place it did without them', () => {
    const pairs = [...parseRecordings(mei).recordings[0].noteSpans.entries()]
      .slice(0, 20)
      .map(([score_id, span]) => ({ score_id, performance_id: span.id }))

    const before = applyAlignment(mei, midi, pairs)
    const after = applyAlignment(mei, midi, pairs, {
      divergences: [added([spans[0].id, spans[1].id], scoreId), missing([otherScoreId])],
    })

    const drawnBefore = noteheadXs(before)
    const drawnAfter = noteheadXs(after)

    expect(drawnBefore.size).toBeGreaterThan(10)
    expect(drawnAfter.size).toBe(drawnBefore.size)
    for (const [id, x] of drawnBefore) expect(drawnAfter.get(id)).toBeCloseTo(x, 5)
  }, 60_000)
})
