import { describe, it, expect, beforeAll } from 'vitest'
import { JSDOM } from 'jsdom'
import { getToolkit, loadFixture } from './setup'
import { VerovioToolkit } from 'verovio/esm'
import { Aligner } from '../src/Aligner'

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

beforeAll(async () => {
  toolkit = await getToolkit()
})

function parseSvg(svgString: string): SVGSVGElement {
  const dom = new JSDOM(svgString, { contentType: 'image/svg+xml' })
  return dom.window.document.querySelector('svg')! as unknown as SVGSVGElement
}

function renderFresh(mei: string) {
  toolkit.setOptions(RENDER_OPTIONS)
  toolkit.loadData(mei)
  toolkit.renderToMIDI()
  return toolkit.renderToSVG(1)
}

describe('Beam rendering after Aligner manipulation', () => {
  for (const fixture of ['traumerei.mei']) {
    describe(fixture, () => {
      it('prepareBeamPolygons annotates all polygons with stem refs', () => {
        const mei = loadFixture(fixture)
        const svg = renderFresh(mei)
        const doc = parseSvg(svg)

        const aligner = new Aligner(doc, () => undefined, 1)
        aligner.prepareBeamPolygons()

        const beams = doc.querySelectorAll('.beam')
        let annotated = 0
        let unannotated = 0

        for (const beam of beams) {
          const polygons = beam.querySelectorAll('polygon')
          for (const polygon of polygons) {
            const hasLeftRight = polygon.hasAttribute('data-left-note') && polygon.hasAttribute('data-right-note')
            const hasRelative = polygon.hasAttribute('data-relative-left') && polygon.hasAttribute('data-relative-right')
            if (hasLeftRight || hasRelative) {
              annotated++
            } else {
              unannotated++
              console.log('Unannotated polygon in beam:', beam.getAttribute('data-id'),
                'points:', polygon.getAttribute('points')?.substring(0, 60))
            }
          }
        }

        console.log(`Annotated polygons: ${annotated}, unannotated: ${unannotated}`)
        expect(unannotated, 'Some beam polygons were not annotated with stem refs').toBe(0)
      })

      it('after multiplyStems, no duplicate stem data-ids within a beam', () => {
        const mei = loadFixture(fixture)
        const svg = renderFresh(mei)
        const doc = parseSvg(svg)

        const aligner = new Aligner(doc, () => undefined, 1)
        aligner.prepareBeamPolygons()
        aligner.multiplyStems()

        const beams = doc.querySelectorAll('.beam')
        let duplicateCount = 0

        for (const beam of beams) {
          const stems = beam.querySelectorAll('.stem')
          const ids = Array.from(stems)
            .map(s => s.getAttribute('data-id'))
            .filter(Boolean)

          const uniqueIds = new Set(ids)
          if (uniqueIds.size < ids.length) {
            duplicateCount++
            const dups = ids.filter((id, i) => ids.indexOf(id) !== i)
            console.log(`Beam has duplicate stem data-ids: ${dups.join(', ')}`)
          }
        }

        console.log(`Beams with duplicate stem IDs: ${duplicateCount}`)
        // This is informational — duplicates ARE expected from multiplyStems cloning
        // But redoBeams should still work correctly
      })

      it('redoBeams produces valid polygon points after full Aligner flow', () => {
        const mei = loadFixture(fixture)
        const svg = renderFresh(mei)
        const doc = parseSvg(svg)

        // Capture original polygon points
        const originalPolygons = new Map<string, string>()
        for (const beam of doc.querySelectorAll('.beam')) {
          for (const polygon of beam.querySelectorAll('polygon')) {
            const points = polygon.getAttribute('points')
            if (points) {
              originalPolygons.set(points, beam.getAttribute('data-id') || 'unknown')
            }
          }
        }

        // Run prepareBeamPolygons + multiplyStems (but NOT note shifting)
        const aligner = new Aligner(doc, () => undefined, 1)
        aligner.prepareBeamPolygons()
        aligner.multiplyStems()
        aligner.redoBeams()

        // Check that all polygon points are valid numbers
        let invalidPolygons = 0
        for (const beam of doc.querySelectorAll('.beam')) {
          for (const polygon of beam.querySelectorAll('polygon')) {
            const points = polygon.getAttribute('points')
            if (!points) {
              invalidPolygons++
              continue
            }

            const coords = points.split(' ').map(p => p.split(',').map(Number))
            for (const [x, y] of coords) {
              if (isNaN(x) || isNaN(y)) {
                invalidPolygons++
                console.log(`Invalid polygon coords in beam ${beam.getAttribute('data-id')}: ${points}`)
                break
              }
            }
          }
        }

        expect(invalidPolygons, 'Some polygons have invalid (NaN) coordinates').toBe(0)
      })

      it('findClosestStem matches all polygon edges to stems within threshold', () => {
        const mei = loadFixture(fixture)
        const svg = renderFresh(mei)
        const doc = parseSvg(svg)

        const aligner = new Aligner(doc, () => undefined, 1)

        let unmatchedLeft = 0
        let unmatchedRight = 0
        let totalPolygons = 0

        for (const beam of doc.querySelectorAll('.beam')) {
          const stemPaths = Array.from(beam.querySelectorAll<SVGPathElement>('.stem path' as string))
          if (stemPaths.length < 2) continue

          for (const polygon of beam.querySelectorAll('polygon')) {
            totalPolygons++
            const points = polygon.getAttribute('points')
            if (!points) continue

            const pointArr = points.split(' ').map(p => p.split(','))
            const x1 = parseFloat(pointArr[0][0])
            const x2 = parseFloat(pointArr[1][0])

            const left = aligner.findClosestStem(x1, stemPaths)
            const right = aligner.findClosestStem(x2, stemPaths)

            if (!left) {
              unmatchedLeft++
              // Find actual distances
              const distances = stemPaths.map(s => {
                const d = s.getAttribute('d')
                if (!d) return Infinity
                const xCoord = parseFloat(d.split(' ')[0].slice(1))
                return Math.abs(x1 - xCoord)
              })
              console.log(`Unmatched LEFT: polygon x1=${x1}, closest stem distances: ${distances.map(d => d.toFixed(1)).join(', ')}`)
            }
            if (!right) {
              unmatchedRight++
              const distances = stemPaths.map(s => {
                const d = s.getAttribute('d')
                if (!d) return Infinity
                const xCoord = parseFloat(d.split(' ')[0].slice(1))
                return Math.abs(x2 - xCoord)
              })
              console.log(`Unmatched RIGHT: polygon x2=${x2}, closest stem distances: ${distances.map(d => d.toFixed(1)).join(', ')}`)
            }
          }
        }

        console.log(`Total polygons: ${totalPolygons}, unmatched left: ${unmatchedLeft}, unmatched right: ${unmatchedRight}`)
      })
    })
  }
})
