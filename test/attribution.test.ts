// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { attributionsOf, ATTRIBUTION_CONF } from '../src/alignment/mlign/attribution'
import { accumulateLogits } from '../src/alignment/mlign/accumulate'
import { UNCOVERED_SIM, type MlignRow, type SimBundle } from '../src/alignment/mlign/types'
import type { EncoderOutput, MlignSession, ModelFeeds, RunOptions } from '../src/alignment/mlign/session'

/** `attr` is row-major (m, n): one row per played note, over the written ones. */
const bundle = (n: number, m: number, rows: number[][], none: number[]): SimBundle => ({
  n,
  m,
  sim: new Float32Array(n * m),
  nullS: new Float32Array(n),
  nullP: new Float32Array(m),
  attr: Float32Array.from(rows.flat()),
  attrNone: Float32Array.from(none),
})

describe('reading the ornament-attribution head', () => {
  it('names the written note a played note decorates', () => {
    const found = attributionsOf(bundle(3, 1, [[0, 8, 1]], [0]))

    expect(found.get(0)?.scoreIdx).toBe(1)
    expect(found.get(0)!.confidence).toBeGreaterThan(0.99)
  })

  it('says nothing about a note it calls no ornament', () => {
    // The "none" column wins, which is the answer for most played notes
    const found = attributionsOf(bundle(3, 1, [[1, 2, 1]], [9]))

    expect(found.size).toBe(0)
  })

  it('withholds an answer it is not sure enough of', () => {
    // Two written notes neck and neck: the argmax is meaningless
    const found = attributionsOf(bundle(2, 1, [[5, 5.01]], [4.9]))

    expect(found.size).toBe(0)
    expect(attributionsOf(bundle(2, 1, [[5, 5.01]], [4.9]), 0).size).toBe(1)
  })

  it('says nothing at all about a played note no window covered', () => {
    const found = attributionsOf(
      bundle(2, 1, [[UNCOVERED_SIM, UNCOVERED_SIM]], [UNCOVERED_SIM])
    )

    expect(found.size).toBe(0)
  })

  it('is a softmax over the whole row, so a long piece dilutes a weak answer', () => {
    const many = Array.from({ length: 200 }, () => 1)
    many[7] = 2

    const found = attributionsOf(bundle(200, 1, [many], [1]), 0)
    expect(found.get(0)?.scoreIdx).toBe(7)
    // 2 against 200 ones: the argmax is right and worth very little
    expect(found.get(0)!.confidence).toBeLessThan(ATTRIBUTION_CONF)
  })
})

/**
 * A session whose attribution head puts every played note on score note 1, and
 * whose alignment outputs are flat. Two windows' worth of vectors so the
 * averaging is exercised.
 */
const attributingSession = (): MlignSession => ({
  hasAttribution: true,
  async run(feeds: ModelFeeds, options: RunOptions = {}): Promise<EncoderOutput> {
    const { n, m } = feeds
    const T = 2 + n + m
    const d = 4
    const out: EncoderOutput = {
      n,
      m,
      T,
      s: new Float32Array(T * d),
      p: new Float32Array(T * d),
      matchS: new Float32Array(T),
      matchP: new Float32Array(T),
      scale: 1,
    }
    if (!options.attribution) return out

    // attr_s puts score note 1 on a direction of its own; attr_p sends every
    // played note down it. attr_none stays orthogonal, so "none" scores 0.
    const attrS = new Float32Array(T * d)
    const attrP = new Float32Array(T * d)
    if (n > 1) attrS[(1 + 1) * d + 0] = 1
    for (let j = 0; j < m; j++) attrP[(2 + n + j) * d + 0] = 6

    return {
      ...out,
      attrS,
      attrP,
      attrNone: Float32Array.from([0, 1, 0, 0]),
      attrScale: 1,
    }
  },
  async release() {},
})

/** `[onset, duration, pitch, voice|velocity]`, in the model's own units. */
const row = (n: number, m: number): MlignRow => ({
  score: Array.from({ length: n }, (_, i) => [i * 720, 720, 60 + i, 0] as [number, number, number, number]),
  perf: Array.from({ length: m }, (_, j) => [j * 500, 250, 60 + j, 64] as [number, number, number, number]),
})

describe('accumulating the attribution head over windows', () => {
  it('brings it back only when it is asked for', async () => {
    const session = attributingSession()
    const plain = await accumulateLogits(session, row(3, 3), [[0, 3, 0, 3]])
    expect(plain.attr).toBeUndefined()

    const asked = await accumulateLogits(session, row(3, 3), [[0, 3, 0, 3]], undefined, {
      attribution: true,
    })
    expect(asked.attr).toHaveLength(9)
    expect(attributionsOf(asked).get(0)?.scoreIdx).toBe(1)
  })

  it('leaves it out for a model whose graph has no such head', async () => {
    const session: MlignSession = { ...attributingSession(), hasAttribution: false }
    const bundle = await accumulateLogits(session, row(3, 3), [[0, 3, 0, 3]], undefined, {
      attribution: true,
    })

    expect(bundle.attr).toBeUndefined()
    expect(attributionsOf(bundle).size).toBe(0)
  })

  it('averages it rather than doubling it, as the match head is doubled', async () => {
    const session = attributingSession()
    const one = await accumulateLogits(session, row(4, 4), [[0, 4, 0, 4]], undefined, {
      attribution: true,
    })
    // Two overlapping windows over the same notes: the same value, averaged,
    // not summed and not doubled
    const two = await accumulateLogits(
      session,
      row(4, 4),
      [
        [0, 4, 0, 4],
        [0, 4, 0, 4],
      ],
      undefined,
      { attribution: true }
    )

    expect([...two.attr!]).toEqual([...one.attr!])
    expect([...two.attrNone!]).toEqual([...one.attrNone!])
    // 6 * 1, once, is what one window's dot product comes to
    expect(one.attr![0 * 4 + 1]).toBeCloseTo(6, 5)
  })

  it('marks a note no window reached rather than calling it no ornament', async () => {
    const session = attributingSession()
    const bundle = await accumulateLogits(session, row(4, 4), [[0, 4, 0, 2]], undefined, {
      attribution: true,
    })

    expect(bundle.attrNone![3]).toBe(UNCOVERED_SIM)
    expect(attributionsOf(bundle).has(3)).toBe(false)
    expect(attributionsOf(bundle).has(0)).toBe(true)
  })
})
