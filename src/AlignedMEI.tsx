'use client'

import { loadVerovio } from "./loadVerovio.mjs";
import { useState, useEffect, useLayoutEffect } from "react";
import { usePiano } from "react-pianosound";
import { VerovioToolkit } from 'verovio/esm'
import { AnySpan } from "./MidiSpans";

const shiftPath = (d: string, shiftX: number, shiftY: number): string => {
  if (!d || typeof d !== 'string') return d;
  
  let isX = true
  try {
    return d.replace(/-?\d+(\.\d+)?/g, (numStr) => {
      const num = parseFloat(numStr)
      if (isNaN(num)) return numStr; // Return original if not a valid number
      
      const shifted = isX ? num + shiftX : num + shiftY
      isX = !isX
      return shifted.toString()
    })
  } catch (error) {
    console.warn('Error shifting path:', error)
    return d; // Return original path if shifting fails
  }
}

const parseTranslate = (transform: string): { x: number, y: number, regex: RegExp } | undefined => {
  if (!transform || typeof transform !== 'string') return undefined;
  
  const translateRegex = /translate\(\s*([-0-9.]+)(?:[ ,]\s*([-0-9.]+))?\s*\)/
  const match = transform.match(translateRegex)
  if (!match) return undefined

  const [, x, y = '0'] = match
  const parsedX = parseFloat(x);
  const parsedY = parseFloat(y);
  
  // Validate parsed numbers
  if (isNaN(parsedX) || isNaN(parsedY)) return undefined;
  
  return {
    x: parsedX,
    y: parsedY,
    regex: translateRegex
  }
}

/**
 * Aligner class handles the visual alignment of score elements
 * in complex musical notation scenarios, providing robust error handling
 * and support for edge cases commonly found in pieces like Chopin nocturnes.
 */
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

    // Shift stems more safely
    const stemPaths = note.querySelectorAll('.stem path')
    for (const stem of stemPaths) {
      if (!stem.hasAttribute('d')) continue
      const d = stem.getAttribute('d')!
      try {
        const newD = shiftPath(d, shift, 0)
        stem.setAttribute('d', newD)
      } catch (error) {
        console.warn('Failed to shift stem path:', error)
      }
    }

    // Find and shift ledger lines more robustly
    const dashes = this.getLedgerDashesFor(note)
    for (const dash of dashes) {
      const d = dash.getAttribute('d')
      if (!d) continue

      try {
        const newDashD = shiftPath(d, shift, 0)
        dash.setAttribute('d', newDashD)
      } catch (error) {
        console.warn('Failed to shift ledger line:', error)
      }
    }

    // Handle any additional elements that might need shifting
    const flags = note.querySelectorAll('.flag path')
    for (const flag of flags) {
      if (!flag.hasAttribute('d')) continue
      const d = flag.getAttribute('d')!
      try {
        const newD = shiftPath(d, shift, 0)
        flag.setAttribute('d', newD)
      } catch (error) {
        console.warn('Failed to shift flag path:', error)
      }
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

        const notes = chord.querySelectorAll<SVGElement>('.note');
        if (notes.length === 0) return;

        for (const note of notes) {
          const clone = stem.cloneNode(true) as SVGElement;
          note.appendChild(clone);

          // However, the stem is possibly too long now
          const path = clone.querySelector('path')
          if (!path) continue

          const d = path.getAttribute('d');
          if (!d) continue

          const parts = d.split(' ')
          // Handle various stem path formats more flexibly
          if (parts.length < 2) continue

          // conveniently, stems are always drawn from
          // there note roots, so we can simply replace 
          // the first y value.
          const noteTransform = note.querySelector('use')?.getAttribute('transform') || '';
          const noteY = parseTranslate(noteTransform)?.y;
          
          if (noteY !== undefined) {
            // Handle different path formats (M x y L x y, or just coordinates)
            if (parts[0].startsWith('M')) {
              // Format: M x y L x y
              if (parts.length >= 4) {
                parts[2] = noteY.toString(); // Replace y in M x y
                path.setAttribute('d', parts.join(' '));
              }
            } else if (parts.length >= 2) {
              // Format: x y x y (simple coordinate pairs)
              parts[1] = noteY.toString();
              path.setAttribute('d', parts.join(' '));
            }
          }
        }
        
        // Only remove original stem after successfully processing all notes
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
      if (!startId || !endId) continue

      const startUse = this.svg.querySelector(`.note[data-id="${startId.slice(1)}"] use`);
      const endUse = this.svg.querySelector(`.note[data-id="${endId.slice(1)}"] use`);
      if (!startUse || !endUse) continue;

      const startTransform = startUse.getAttribute('transform');
      const endTransform = endUse.getAttribute('transform');
      if (!startTransform || !endTransform) continue;

      const startX = parseTranslate(startTransform)?.x || 0;
      const endX = parseTranslate(endTransform)?.x || 0;
      
      // Calculate tie endpoints with safer offsets
      const noteWidth = 200; // Approximate note width
      const x1 = startX + noteWidth;
      const x2 = endX - (noteWidth * 0.4);
      
      // Ensure minimum tie length
      if (Math.abs(x2 - x1) < 50) continue;
      
      const middleX1 = x1 + (x2 - x1) * 0.25;
      const middleX2 = x1 + (x2 - x1) * 0.75;

      const originalPath = path.getAttribute('d');
      if (!originalPath) continue;

      const points = originalPath.split(' ');
      if (points.length < 5) {
        console.log('Insufficient control points for tie');
        continue;
      }

      // Extract original y-coordinates more safely
      const startPoint = points[0];
      const startY = startPoint.includes(',') ? startPoint.split(',')[1] : points[1];
      
      if (!startY) continue;

      // Preserve original curve characteristics but update x-coordinates
      const middlePoints = points.slice(1, -1).map(point => {
        if (point.includes(',')) {
          return point.split(',')[1];
        }
        return point;
      }).filter(y => !isNaN(parseFloat(y)));

      if (middlePoints.length >= 2) {
        const middleY1 = Math.max(...middlePoints.map(y => parseFloat(y)));
        const middleY2 = Math.min(...middlePoints.map(y => parseFloat(y)));

        const newPath = `M${x1},${startY} C${middleX1},${middleY1} ${middleX2},${middleY1} ${x2},${startY} C${middleX2},${middleY2} ${middleX1},${middleY1} ${x1},${startY}`;
        path.setAttribute('d', newPath);
      }
    }
  }

  redoBeams() {
    const beams = this.svg.querySelectorAll('.beam');
    for (const beam of beams) {
      // get the x's of the first and the last stem
      const stems = beam.querySelectorAll('.note .stem path');
      if (stems.length <= 1) continue;

      const stem1 = stems[0];
      const stem2 = stems[stems.length - 1];

      // Extract x coordinates more safely
      const d1 = stem1.getAttribute('d');
      const d2 = stem2.getAttribute('d');
      if (!d1 || !d2) continue;

      const parts1 = d1.split(' ');
      const parts2 = d2.split(' ');
      if (parts1.length === 0 || parts2.length === 0) continue;

      const x1 = parts1[0].startsWith('M') ? parts1[0].slice(1) : parts1[0];
      const x2 = parts2[0].startsWith('M') ? parts2[0].slice(1) : parts2[0];
      
      if (!x1 || !x2) continue;

      // Handle multiple polygons in complex beams
      const polygons = beam.querySelectorAll('polygon');
      for (const polygon of polygons) {
        const points = polygon.getAttribute('points');
        if (!points) continue;

        const pointArr = points.split(' ').map(p => p.split(','));
        // Ensure we have at least 4 points for a proper polygon
        if (pointArr.length < 4) continue;

        // Safely update polygon points, preserving y-coordinates
        try {
          polygon.setAttribute('points', `${x1},${pointArr[0][1]} ${x2},${pointArr[1][1]} ${x2},${pointArr[2][1]} ${x1},${pointArr[3][1]}`);
        } catch (error) {
          console.warn('Failed to update beam polygon:', error);
        }
      }
    }
  }

  redoBarLines() {
    const measures = this.svg.querySelectorAll('.measure');
    for (let i = 0; i < measures.length - 1; i++) {
      // find the last x in this measure and the first x in the next
      const currentMeasure = measures[i];
      const nextMeasure = measures[i + 1];

      // Get all note positions in current measure
      const currentNoteUses = currentMeasure.querySelectorAll('.notehead use');
      const nextNoteUses = nextMeasure.querySelectorAll('.notehead use');
      
      if (currentNoteUses.length === 0 || nextNoteUses.length === 0) continue;

      // Calculate positions more safely
      const currentXs = Array.from(currentNoteUses)
        .map(use => {
          const transform = use.getAttribute('transform');
          return transform ? parseTranslate(transform)?.x || 0 : 0;
        })
        .filter(x => x > 0);

      const nextXs = Array.from(nextNoteUses)
        .map(use => {
          const transform = use.getAttribute('transform');
          return transform ? parseTranslate(transform)?.x || 0 : 0;
        })
        .filter(x => x > 0);

      if (currentXs.length === 0 || nextXs.length === 0) continue;

      const maxX = Math.max(...currentXs);
      const minX = Math.min(...nextXs);
      
      // Use a more conservative positioning approach
      const avgX = (maxX + minX) / 2;
      
      // Only proceed if the calculated position makes sense
      if (avgX <= maxX || avgX >= minX) continue;

      const barLines = currentMeasure.querySelectorAll('.barLine path');
      barLines.forEach(line => {
        const d = line.getAttribute('d');
        if (!d) return;
        
        const parts = d.split(' ');
        if (parts.length < 4) return;
        
        // Extract y-coordinates safely
        const y1 = parts[1];
        const y2 = parts[3];
        
        if (y1 && y2) {
          line.setAttribute('d', `M${avgX} ${y1} L${avgX} ${y2}`);
          line.setAttribute('stroke-dasharray', '82 82');
          line.setAttribute('stroke-width', '12');
        }
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
  const { playSingleNote } = usePiano()
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
      try {
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
            try {
              const svgCoords = toSVG([lastSpan.onsetMs, 0]);
              if (svgCoords && typeof svgCoords[0] === 'number') {
                aligner.shiftNote(svgNote, svgCoords[0])
              }
            } catch (error) {
              console.warn('Failed to shift deletion note:', error)
            }
          }

          svgNote.setAttribute('fill', 'red');
          continue
        }
        lastSpan = span

        // set the opacity according to the velocity
        if ('velocity' in span && typeof span.velocity === 'number') {
          try {
            aligner.changeOpacity(svgNote, span.velocity)
          } catch (error) {
            console.warn('Failed to change note opacity:', error)
          }
        }

        // set the X position based on the onset time
        try {
          const svgCoords = toSVG([span.onsetMs, 0]);
          if (svgCoords && typeof svgCoords[0] === 'number') {
            const newX = svgCoords[0]
            aligner.shiftNote(svgNote, newX)

            // Move the second note of a tie and set its
            // opacity based on the velocity
            const endNote = aligner.tiedNoteOf(svgNote)
            if (endNote) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const times = toolkit.getTimesForElement(xmlId) as any
                if (times && times.qfracDuration && times.qfracTiedDuration) {
                  const [num1, denom1] = times.qfracDuration[0]
                  const [num2, denom2] = times.qfracTiedDuration[0]
                  
                  if (denom1 && denom2 && (denom1 !== 0) && (denom2 !== 0)) {
                    const dur = num1 / denom1
                    const tied = num2 / denom2
                    const share = dur / (dur + tied)
                    
                    if (!isNaN(share) && share > 0 && share <= 1) {
                      const durationCoords = toSVG([span.offsetMs - span.onsetMs, 0]);
                      if (durationCoords && typeof durationCoords[0] === 'number') {
                        const endX = newX + share * durationCoords[0]
                        aligner.shiftNote(endNote, endX);

                        if ('velocity' in span && typeof span.velocity === 'number') {
                          aligner.changeOpacity(endNote, span.velocity)
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn('Failed to process tied note:', error)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to shift note position:', error)
        }
      } catch (error) {
        console.warn('Error processing note:', error)
      }
    }

    try {
      aligner.redoTies();
    } catch (error) {
      console.warn('Failed to redo ties:', error);
    }

    try {
      aligner.redoBeams();
    } catch (error) {
      console.warn('Failed to redo beams:', error);
    }

    try {
      aligner.redoBarLines();
    } catch (error) {
      console.warn('Failed to redo bar lines:', error);
    }
  }, [svg, getSpanForNote, toSVG, highlight, onClick, mei, toolkit, playSingleNote]);

  useEffect(() => {
    loadVerovio().then((toolkit) => {
      toolkit.setOptions({
        adjustPageHeight: true,
        adjustPageWidth: true,
        scale: 100,
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
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

