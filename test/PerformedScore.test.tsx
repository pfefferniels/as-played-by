// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PerformedScore, type PerformedNote } from '../src/verovio/PerformedScore'
import { unitsPerSecond } from '../src/verovio/toolkit'

const mei = readFileSync(join(__dirname, '..', 'public', 'transcription.mei'), 'utf-8')
const options = { performanceRecording: '1' }

let container: HTMLDivElement
let root: Root
const clicked: PerformedNote[] = []
const hovered: PerformedNote[] = []

async function show(extenders: boolean) {
  await act(async () => {
    root.render(
      <PerformedScore
        mei={mei}
        options={options}
        extenders={extenders}
        onNoteClick={(note) => clicked.push(note)}
        onNoteHover={(note) => hovered.push(note)}
      />
    )
  })
}

/** Where an extender runs, and whether it is closed with a release tick */
function geometryOf(extender: Element) {
  const d = extender.getAttribute('d')!
  const line = d.match(/^M([-0-9.]+) ([-0-9.]+) H([-0-9.]+)/)!

  return {
    start: Number(line[1]),
    y: Number(line[2]),
    end: Number(line[3]),
    closed: d.includes('V'),
  }
}

/** Give the toolkit the turns it needs to load and lay the score out */
async function settle(until: () => boolean) {
  for (let attempt = 0; attempt < 200 && !until(); attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  }
}

beforeAll(async () => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  await show(false)
  await settle(() => container.querySelector('.note') !== null)
}, 60_000)

describe('<PerformedScore>', () => {
  it('renders every system of the performance', () => {
    expect(container.querySelectorAll('.system').length).toBeGreaterThan(1)
    expect(container.querySelectorAll('.note').length).toBeGreaterThan(50)
    expect(container.querySelector('.performanceRuler')).not.toBeNull()
  })

  it('reports the note that was clicked, and the one hovered over', () => {
    const notehead = container.querySelector('.note .notehead use')!

    notehead.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    notehead.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(clicked).toHaveLength(1)
    expect(clicked[0].id).toBe(notehead.closest('.note')!.getAttribute('data-id'))
    expect(clicked[0].onsetMs).toBeGreaterThan(0)
    expect(clicked[0].pitch).toBeGreaterThan(20)
    expect(hovered).toEqual(clicked)
  })

  it('draws no extenders unless it is asked to', () => {
    expect(container.querySelectorAll('.performanceExtender')).toHaveLength(0)
  })

  it('extends a note to where the recording released it', async () => {
    await show(true)

    const extenders = [...container.querySelectorAll('.performanceExtender')]
    expect(extenders.length).toBeGreaterThan(20)

    let reachedTheRelease = 0

    for (const extender of extenders) {
      const note = extender.closest('.note')!
      const held =
        (Number(note.getAttribute('data-perf-offset')) -
          Number(note.getAttribute('data-perf-onset'))) /
        1000

      const noteX = Number(
        note
          .querySelector('.notehead use')!
          .getAttribute('transform')!
          .match(/translate\(\s*([-0-9.]+)/)![1]
      )

      const released = noteX + held * unitsPerSecond(options)
      const { start, end, closed } = geometryOf(extender)

      // The line starts clear of the notehead and runs flat to the release, or to
      // the end of the system when the note was still held there
      expect(start).toBeGreaterThan(noteX)
      expect(end).toBeLessThanOrEqual(released + 1)

      if (Math.abs(end - released) < 1) {
        // Only a line that reached the release is closed with a tick
        expect(closed).toBe(true)
        reachedTheRelease++
      } else {
        expect(closed).toBe(false)
      }
    }

    expect(reachedTheRelease).toBeGreaterThan(extenders.length / 2)
  })

  it('cuts a line off at the end of its system', async () => {
    for (const extender of container.querySelectorAll('.performanceExtender')) {
      const staves = [...extender.closest('.system')!.querySelectorAll('.staff > path')]
      const edge = Math.max(
        ...staves.map((line) => Number(line.getAttribute('d')!.match(/L\s*([-0-9.]+)/)![1]))
      )

      expect(geometryOf(extender).end).toBeLessThanOrEqual(edge + 1)
    }
  })

  it('takes the extenders away again', async () => {
    await show(false)
    expect(container.querySelectorAll('.performanceExtender')).toHaveLength(0)
  })

  it('says nothing about a click that missed the notes', () => {
    const before = clicked.length
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicked).toHaveLength(before)
  })
})
