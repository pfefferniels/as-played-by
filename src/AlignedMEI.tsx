'use client'

import { loadVerovio } from "./loadVerovio.mjs";
import { useState, useEffect, useLayoutEffect } from "react";
// import { usePiano } from "react-pianosound";
import { VerovioToolkit } from 'verovio/esm'
import { AnySpan } from "./MidiSpans";

const shiftPath = (d: string, shiftX: number, shiftY: number): string => {
  let isX = true
  return d.replace(/-?\d+(\.\d+)?/g, (numStr) => {
    const num = parseFloat(numStr)
    const shifted = isX ? num + shiftX : num + shiftY
    isX = !isX
    return shifted.toString()
  })
}

const parseTranslate = (transform: string): { x: number, y: number, regex: RegExp } | undefined => {
  const translateRegex = /translate\(\s*([-0-9.]+)(?:[ ,]\s*([-0-9.]+))?\s*\)/
  const match = transform.match(translateRegex)
  if (!match) return

  const [, x, y = '0'] = match
  return {
    x: +x,
    y: +y,
    regex: translateRegex
  }
}

class Aligner {
  svg: SVGSVGElement

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
  }

  shiftNote(note: SVGElement, newX: number) {
    const use = note.querySelector('use')
    if (!use) return

    const transform = use.getAttribute('transform') || ''
    const translateData = parseTranslate(transform)
    if (!translateData) return

    const { x: origX, y: origY, regex: translateRegex } = translateData
    const replacedTransform = transform.replace(translateRegex, `translate(${newX}, ${origY})`)
    use.setAttribute('transform', replacedTransform)

    const shift = newX - +origX

    // Shift stems
    const stem = note.querySelector('.stem path')
    if (!stem || !stem.hasAttribute('d')) return
    const newD = shiftPath(stem.getAttribute('d')!, shift, 0)
    stem.setAttribute('d', newD)

    // Find and shift ledger lines
    const dashes = this.getLedgerDashesFor(note)
    for (const dash of dashes) {
      const d = dash.getAttribute('d')
      if (!d) continue

      const newDashD = shiftPath(d, shift, 0)
      dash.setAttribute('d', newDashD)
    }
  }

  changeOpacity(note: SVGElement, newValue: number, originalRange: [number, number] = [30, 50]) {
    note.querySelectorAll('use,path').forEach(path => {
      path.setAttribute('fill-opacity', convertRange(+newValue, originalRange, [0.2, 1]).toString())
      path.setAttribute('stroke-opacity', convertRange(+newValue, originalRange, [0.2, 1]).toString())
    })

    const dashes = this.getLedgerDashesFor(note)
    for (const dash of dashes) {
      const opacity = convertRange(+newValue, originalRange, [0.2, 1])
      dash.setAttribute('stroke-opacity', opacity.toString())
      dash.setAttribute('fill-opacity', opacity.toString())
    }
  }

  multiplyStems() {
    // chord stems live within .chord. Since 
    // every note of a chord will be in another
    // place, we need to multiply that stem
    // and move each clone into .note
    Array.from(this.svg.querySelectorAll<SVGGElement>('.chord'))
      .forEach(chord => {
        const stem = chord.querySelector<SVGElement>('.stem')
        if (!stem) return;

        for (const note of chord.querySelectorAll<SVGElement>('.note')) {
          const clone = stem.cloneNode(true) as SVGElement;
          note.appendChild(clone);

          // However, the stem is possibly too long now
          const path = clone.querySelector('path')
          if (!path) continue

          const d = path.getAttribute('d');
          if (!d) continue

          const parts = d.split(' ')
          if (parts.length !== 4) continue

          // conveniently, stems are always drawn from
          // there note roots, so we can simply replace 
          // the first y value.
          const noteY = parseTranslate(note.querySelector('use')?.getAttribute('transform') || '')?.y
          if (noteY) {
            parts[1] = noteY.toString()
            path.setAttribute('d', parts.join(' '));
          }
        }
        stem.remove();
      });
  }

  redoTies() {
    const ties = this.svg.querySelectorAll('.tie');
    for (const tie of ties) {
      const path = tie.querySelector('path');
      if (!path) {
        console.log('No path found for tie');
        continue;
      }

      const startId = tie.getAttribute('data-startid');
      const endId = tie.getAttribute('data-endid');
      if (!startId || !endId) return

      const startUse = this.svg.querySelector(`.note[data-id="${startId.slice(1)}"] use`);
      const endUse = this.svg.querySelector(`.note[data-id="${endId.slice(1)}"] use`);
      if (!startUse || !endUse) continue;

      const x1 = (parseTranslate(startUse.getAttribute('transform')!)?.x || 0) + 300;
      const x2 = (parseTranslate(endUse.getAttribute('transform')!)?.x || 0) - 80;
      const middleX1 = x1 + (x2 - x1) * 0.25;
      const middleX2 = x1 + (x2 - x1) * 0.75;

      const points = path.getAttribute('d')?.split(' ');
      if (!points || points.length < 5) {
        console.log('Something is wrong with the control points');
        continue;
      }

      const y1 = points[0].split(',')[1];
      const middlePoints = [+points[1].split(',')[1], +points[4].split(',')[1]];
      const middleY1 = Math.max(...middlePoints);
      const middleY2 = Math.min(...middlePoints);

      path.setAttribute('d', `M${x1},${y1} C${middleX1},${middleY1} ${middleX2},${middleY1} ${x2},${y1} C${middleX2},${middleY2} ${middleX1},${middleY1} ${x1},${y1}`);
    }
  }

  redoBeams() {
    const beams = document.querySelectorAll('.beam');
    for (const beam of beams) {
      // get the x's of the first and the last stem
      const stems = beam.querySelectorAll('.note .stem path');
      if (stems.length <= 1) continue;

      const stem1 = stems[0];
      const stem2 = stems[stems.length - 1];

      const x1 = stem1.getAttribute('d')?.split(' ')[0].slice(1);
      const x2 = stem2.getAttribute('d')?.split(' ')[0].slice(1);
      // console.log('beam from', x1, 'to', x2)
      const polygon = beam.querySelector('polygon');
      const points = polygon?.getAttribute('points');
      if (!points) continue;

      const pointArr = points.split(' ').map(p => p.split(','));
      polygon?.setAttribute('points', `${x1},${pointArr[0][1]} ${x2},${pointArr[1][1]} ${x2},${pointArr[2][1]} ${x1},${pointArr[3][1]}`);
    }
  }

  redoBarLines() {
    const measures = document.querySelectorAll('.measure');
    for (let i = 0; i < measures.length - 1; i++) {
      // find the last x in this measure and the first x in the next
      const currentMeasure = measures[i];
      const nextMeasure = measures[i + 1];

      // console.log('current measure', currentMeasure.getAttribute('data-n'))
      // console.log('next measure', nextMeasure.getAttribute('data-n'))
      const maxX = Math.max(
        ...Array
          .from(currentMeasure.querySelectorAll('.notehead use'))
          .map(use => {
            return parseTranslate(use.getAttribute('transform')!)?.x || 0;
          }));

      const minX = Math.min(
        ...Array
          .from(nextMeasure.querySelectorAll('.notehead use'))
          .map(use => {
            return parseTranslate(use.getAttribute('transform')!)?.x || 0;
          })
      );

      const avgX = (maxX + minX) / 2 + 100;

      currentMeasure.querySelectorAll('.barLine path').forEach(line => {
        const d = line.getAttribute('d')?.split(' ');
        if (!d) return;
        line.setAttribute('d', `M${avgX} ${d[1]} L${avgX} ${d[3]}`);
        line.setAttribute('stroke-dasharray', '82 82');
        line.setAttribute('stroke-width', '12')
      });
    }
  }

  tiedNoteOf(note: SVGElement) {
    const id = note.getAttribute('data-id')
    const tie = this.svg.querySelector(`.tie[data-startid="#${id}"]`)
    if (!tie) return null

    // the note is part of a tie. Find the end note
    const endid = tie.getAttribute('data-endid')
    if (!endid) return null

    return this.svg.querySelector(`[data-id="${endid.slice(1)}"]`) as SVGElement | null
  }

  private getLedgerDashesFor(note: SVGElement): NodeListOf<SVGPathElement> {
    const id = note.getAttribute('data-id')
    if (!id) return this.svg.querySelectorAll('.lineDash')

    return this.svg.querySelectorAll(`.lineDash[data-related="#${id}"] path`)
  }
}

const convertRange = (value: number, r1: [number, number], r2: [number, number]) => {
  return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
}

interface AlignedMEIProps {
  mei: string
  getSpanForNote: (id: string) => AnySpan | 'deletion' | undefined
  toSVG: (point: [number, number]) => [number, number]
  highlight?: string
  onClick: (svgNote: SVGElement) => void
}

export const AlignedMEI = ({ mei, getSpanForNote, toSVG, highlight, onClick }: AlignedMEIProps) => {
  // const { playSingleNote } = usePiano()
  const [svg, setSVG] = useState<string>('');
  const [toolkit, setToolkit] = useState<VerovioToolkit>()

  useLayoutEffect(() => {
    const svg = document.querySelector('#scoreDiv svg') as SVGSVGElement | null;
    if (!svg || !toolkit) return;

    const aligner = new Aligner(svg);

    // hide certain things
    const elementsToHide = svg.querySelectorAll('.clef, .meterSig, .flag, .dots, .rest, .accid, .fermata, .artic, .slur, .hairpin, .tempo, .fermata, .dynam, .dir');
    elementsToHide.forEach(el => {
      (el as SVGGraphicsElement).style.display = 'none';
    });

    // displace notes based on matched pairs
    const meiDoc = new DOMParser().parseFromString(mei, 'application/xml')
    const notes = meiDoc.querySelectorAll('note')

    aligner.multiplyStems();

    let lastSpan: AnySpan | undefined = undefined
    for (const note of notes) {
      const xmlId = note.getAttribute('xml:id')
      if (!xmlId) continue

      const svgNote = svg?.querySelector(`[data-id="${xmlId}"]`) as SVGElement | null
      if (!svgNote) {
        console.log('No corresponding SVG note found for', xmlId)
        continue
      }

      svgNote.addEventListener('click', () => onClick(svgNote))

      const span = getSpanForNote(xmlId)
      if (!span) {
        continue
      }
      else if (span === 'deletion') {
        if (lastSpan) {
          aligner.shiftNote(svgNote, toSVG([lastSpan.onsetMs, 0])[0])
        }

        svgNote.setAttribute('fill', 'red');
        continue
      }
      lastSpan = span

      // set the opacity according to the velocity
      if ('velocity' in span) {
        aligner.changeOpacity(svgNote, span.velocity)
      }

      // set the X position based on the onset time
      const newX = toSVG([span.onsetMs, 0])[0]
      aligner.shiftNote(svgNote, newX)

      // Move the second note of a tie and set its
      // opacity based on the velocity
      const endNote = aligner.tiedNoteOf(svgNote)
      if (endNote) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const times = toolkit.getTimesForElement(xmlId) as any
        const [num1, denom1] = times.qfracDuration[0]
        const [num2, denom2] = times.qfracTiedDuration[0]
        const dur = num1 / denom1
        const tied = num2 / denom2
        const share = dur / (dur + tied)
        const endX = newX + share * toSVG([span.offsetMs - span.onsetMs, 0])[0]
        aligner.shiftNote(endNote, endX);

        if ('velocity' in span) {
          aligner.changeOpacity(endNote, span.velocity)
        }
      }
    }

    aligner.redoTies();
    aligner.redoBeams();
    aligner.redoBarLines();
  }, [svg, getSpanForNote, toSVG, highlight, onClick, mei, toolkit]);

  useEffect(() => {
    loadVerovio().then((toolkit) => {
      toolkit.setOptions({
        adjustPageHeight: true,
        adjustPageWidth: true,
        breaks: 'none',
        svgAdditionalAttribute: ['tie@startid', 'tie@endid', 'measure@n', 'layer@n', 'note@corresp'],
        appXPathQuery: ['./rdg[contains(@source, "performance")]'],
        svgHtml5: true
      });
      toolkit.loadData(mei);
      toolkit.renderToMIDI()
      setSVG(toolkit.renderToSVG(1));
      setToolkit(toolkit)
    })
  }, [mei])

  return (
    <div
      id='scoreDiv'
      style={{ position: 'absolute', height: '10vh' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

