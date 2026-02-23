import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { VerovioToolkit } from 'verovio/esm'
import { getToolkit, loadFixture, renderToPng, pixelDiff } from './setup'

const SNAPSHOT_DIR = join(__dirname, '__snapshots__')
const BASELINE_PNG = join(SNAPSHOT_DIR, 'traumerei-baseline.png')

// Same options as AlignedMEI.tsx
const RENDER_OPTIONS = {
  adjustPageHeight: true,
  adjustPageWidth: true,
  scale: 70,
  header: 'none',
  breaks: 'none',
  svgAdditionalAttribute: [
    'tie@startid', 'tie@endid', 'measure@n', 'layer@n',
    'note@corresp', 'note@pname', 'note@oct', 'note@accid', 'note@accid.ges',
  ],
  appXPathQuery: ['./rdg[contains(@source, "performance")]'],
  svgHtml5: true,
}

let toolkit: VerovioToolkit
let mei: string
let svg: string

beforeAll(async () => {
  toolkit = await getToolkit()
  mei = loadFixture('traumerei.mei')
  toolkit.setOptions(RENDER_OPTIONS)
  toolkit.loadData(mei)
  toolkit.renderToMIDI()
  svg = toolkit.renderToSVG(1)
})

describe('Visual regression', () => {
  it('renders SVG → PNG matching baseline', () => {
    const png = renderToPng(svg)

    if (!existsSync(SNAPSHOT_DIR)) {
      mkdirSync(SNAPSHOT_DIR, { recursive: true })
    }

    if (!existsSync(BASELINE_PNG)) {
      // First run: save baseline
      writeFileSync(BASELINE_PNG, png)
      console.log('Baseline PNG saved. Re-run to compare.')
      return
    }

    const baseline = readFileSync(BASELINE_PNG)
    const diff = pixelDiff(baseline, png)
    expect(diff, `Visual diff is ${diff.toFixed(2)}% — exceeds 0.1% threshold`).toBeLessThan(0.1)
  })
})

describe('SVG class selector assertions', () => {
  it('contains .note elements', () => {
    expect(svg).toContain('class="note"')
  })

  it('contains .stem elements', () => {
    expect(svg).toContain('class="stem"')
  })

  it('contains .beam elements', () => {
    expect(svg).toContain('class="beam"')
  })

  it('contains .tie elements', () => {
    expect(svg).toContain('class="tie"')
  })

  it('contains .chord elements', () => {
    expect(svg).toContain('class="chord"')
  })

  it('contains .measure elements', () => {
    expect(svg).toContain('class="measure"')
  })

  it('contains .notehead elements', () => {
    expect(svg).toContain('class="notehead"')
  })

  it('contains .barLine elements', () => {
    expect(svg).toContain('class="barLine"')
  })

  it('contains data-id attributes', () => {
    expect(svg).toMatch(/data-id="/)
  })

  it('contains data-startid on ties', () => {
    expect(svg).toMatch(/data-startid="/)
  })

  it('contains data-endid on ties', () => {
    expect(svg).toMatch(/data-endid="/)
  })

  it('contains use elements with translate transform inside notes', () => {
    // Notes should have <use> with transform="translate(...)"
    expect(svg).toMatch(/<use[^>]*transform="translate\(/)
  })

  it('contains path elements with d attributes inside .stem', () => {
    // Stems contain paths with d attributes
    expect(svg).toMatch(/<path[^>]*d="M/)
  })

  it('contains polygon elements inside .beam', () => {
    expect(svg).toMatch(/<polygon[^>]*points="/)
  })
})

describe('getTimesForElement keys', () => {
  it('returns tstampOn, qfracDuration, qfracTiedDuration', () => {
    // Find a note ID from the SVG (data-id comes before class in verovio SVG)
    const noteIdMatch = svg.match(/data-id="([^"]+)"[^>]*class="note"/)
    expect(noteIdMatch).not.toBeNull()
    const noteId = noteIdMatch![1]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const times = toolkit.getTimesForElement(noteId) as any
    expect(times).toHaveProperty('tstampOn')
    expect(Array.isArray(times.tstampOn)).toBe(true)
    expect(times).toHaveProperty('qfracDuration')
    expect(Array.isArray(times.qfracDuration)).toBe(true)
    expect(times).toHaveProperty('qfracTiedDuration')
    expect(Array.isArray(times.qfracTiedDuration)).toBe(true)
  })
})

describe('getMIDIValuesForElement', () => {
  it('returns .pitch as a number', () => {
    const noteIdMatch = svg.match(/data-id="([^"]+)"[^>]*class="note"/)
    expect(noteIdMatch).not.toBeNull()
    const noteId = noteIdMatch![1]

    const midiValues = toolkit.getMIDIValuesForElement(noteId)
    expect(midiValues).toHaveProperty('pitch')
    expect(typeof midiValues.pitch).toBe('number')
  })
})

describe('Timemap structure', () => {
  it('has qstamp, on, off keys in entries', () => {
    const timemap = toolkit.renderToTimemap()
    expect(timemap.length).toBeGreaterThan(0)

    // Check first 10 entries
    const sample = timemap.slice(0, 10)
    for (const entry of sample) {
      expect(entry).toHaveProperty('qstamp')
      expect(typeof entry.qstamp).toBe('number')
      // on/off may not exist on every entry, but at least some should have them
    }

    // At least one entry should have 'on'
    const hasOn = timemap.some(e => 'on' in e && Array.isArray(e.on))
    expect(hasOn).toBe(true)

    // At least one entry should have 'off'
    const hasOff = timemap.some(e => 'off' in e && Array.isArray(e.off))
    expect(hasOff).toBe(true)
  })

  it('timemap snapshot (first 10 entries)', () => {
    const timemap = toolkit.renderToTimemap()
    expect(timemap.slice(0, 10)).toMatchSnapshot()
  })
})

describe('getMEI round-trip', () => {
  it('produces valid MEI output', () => {
    const meiOutput = toolkit.getMEI()
    expect(meiOutput).toContain('<mei')
    expect(meiOutput).toContain('</mei>')
  })

  it('getMEI snapshot (first 500 chars)', () => {
    const meiOutput = toolkit.getMEI()
    expect(meiOutput.substring(0, 500)).toMatchSnapshot()
  })
})

describe('expand option', () => {
  it('setOptions with expand does not throw', () => {
    expect(() => {
      toolkit.setOptions({ expand: 'someId' })
    }).not.toThrow()
  })

  it('restores original options after expand test', () => {
    // Reset to the rendering options
    toolkit.setOptions(RENDER_OPTIONS)
    toolkit.loadData(mei)
  })
})
