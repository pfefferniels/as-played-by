import { VerovioToolkit } from "verovio/esm"
import { AnySpan } from "./MidiSpans"

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

export class Aligner {
  svg: SVGSVGElement
  getSpanForNote: (noteId: string) => AnySpan | undefined
  stretchX: number = 1

  constructor(
    svg: SVGSVGElement,
    getSpanForNote: (noteId: string) => AnySpan | undefined,
    stretchX: number
  ) {
    this.svg = svg;
    this.getSpanForNote = getSpanForNote;
    this.stretchX = stretchX
  }

  getXOfStem(stemPath: SVGPathElement): number | undefined {
    const d = stemPath.getAttribute('d')
    if (!d) return undefined

    const parts = d.split(' ')
    if (parts.length < 2) return undefined

    const firstPart = parts[0]
    if (!firstPart.startsWith('M')) return undefined

    const xStr = firstPart.slice(1).split(',')[0]
    return parseFloat(xStr)
  }

  getOriginalX(note: SVGElement): number | undefined {
    const use = note.querySelector('use')
    if (!use) return undefined

    const transform = use.getAttribute('transform')
    if (!transform) return undefined

    const translateData = parseTranslate(transform)
    if (!translateData) return undefined

    return translateData.x
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
    if (stem && stem.hasAttribute('d')) {
      const newD = shiftPath(stem.getAttribute('d')!, shift, 0)
      stem.setAttribute('d', newD)
    }

    // Shift accidentals
    const accidUse = note.querySelector('.accid use')
    if (accidUse) {
      const accidTransform = accidUse.getAttribute('transform') || ''
      const accidData = parseTranslate(accidTransform)
      if (accidData) {
        const newAccidTransform = accidTransform.replace(accidData.regex, `translate(${accidData.x + shift}, ${accidData.y})`)
        accidUse.setAttribute('transform', newAccidTransform)
      }
    }

    // Shift flags (inside .stem, use <use> with transform)
    const flagUse = note.querySelector('.stem .flag use')
    if (flagUse) {
      const flagTransform = flagUse.getAttribute('transform') || ''
      const flagData = parseTranslate(flagTransform)
      if (flagData) {
        const newFlagTransform = flagTransform.replace(flagData.regex, `translate(${flagData.x + shift}, ${flagData.y})`)
        flagUse.setAttribute('transform', newFlagTransform)
      }
    }

    // Shift dots (use <ellipse> with cx attribute)
    note.querySelectorAll('.dots ellipse').forEach(dot => {
      const cx = dot.getAttribute('cx')
      if (cx) {
        dot.setAttribute('cx', (parseFloat(cx) + shift).toString())
      }
    })

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
      if (!startId || !endId) continue

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
    const beams = this.svg.querySelectorAll('.beam');
    for (const beam of beams) {
      // get the x's of the first and the last stem
      const stems = beam.querySelectorAll<SVGPathElement>('.note .stem path');
      if (stems.length <= 1) continue;

      const polygons = beam.querySelectorAll('polygon');
      if (polygons.length === 0) continue

      Array
        .from(polygons)
        .filter(polygon => polygon.hasAttribute('data-left-note') && polygon.hasAttribute('data-right-note'))
        .forEach((polygon) => {
          const points = polygon.getAttribute('points');
          if (!points) return;

          const pointArr = points.split(' ').map(p => p.split(','));
          const note1 = this.svg.querySelector<SVGElement>(`.note[data-id="${polygon.getAttribute('data-left-note')}"]`);
          const note2 = this.svg.querySelector<SVGElement>(`.note[data-id="${polygon.getAttribute('data-right-note')}"]`);

          // Fall back to beam's first/last stem if a referenced note was removed (e.g. during tie processing)
          const stem1Path = note1?.querySelector<SVGPathElement>('.stem path') || stems[0];
          const stem2Path = note2?.querySelector<SVGPathElement>('.stem path') || stems[stems.length - 1];
          if (!stem1Path || !stem2Path) return;

          const startX = +(stem1Path.getAttribute('d')!.split(' ')[0].slice(1) || 0)
          const endX = +stem2Path.getAttribute('d')!.split(' ')[0].slice(1);

          polygon.setAttribute('points', `${startX},${pointArr[0][1]} ${endX},${pointArr[1][1]} ${endX},${pointArr[2][1]} ${startX},${pointArr[3][1]}`);
        })

      Array
        .from(polygons)
        .filter(polygon => polygon.hasAttribute('data-relative-left') && polygon.hasAttribute('data-relative-right'))
        .forEach((polygon) => {
          const leftStem = stems[0];
          const rightStem = stems[stems.length - 1];

          const leftX = this.getXOfStem(leftStem);
          const rightX = this.getXOfStem(rightStem);
          if (leftX === undefined || rightX === undefined) {
            console.log('No stems found for beam', beam);
            return;
          }
          const relativeLeft = parseFloat(polygon.getAttribute('data-relative-left') || '0');
          const relativeRight = parseFloat(polygon.getAttribute('data-relative-right') || '1');
          const startX = leftX + relativeLeft * (rightX - leftX);
          const endX = leftX + relativeRight * (rightX - leftX);
          const points = polygon.getAttribute('points');
          if (!points) return;
          const pointArr = points.split(' ').map(p => p.split(','));
          polygon.setAttribute('points', `${startX},${pointArr[0][1]} ${endX},${pointArr[1][1]} ${endX},${pointArr[2][1]} ${startX},${pointArr[3][1]}`);
        })

    }
  }

  findClosestStem(x: number, stems: SVGPathElement[], threshold = 10): SVGPathElement | null {
    let closestStem: SVGPathElement | null = null;
    let minDistance = Infinity;
    for (const stem of stems) {
      const d = stem.getAttribute('d');
      if (!d) continue;

      // extract the x coordinate from the "M{x},{y}" at the start of the path
      const xCoord = parseFloat(d.split(' ')[0].slice(1));
      const distance = Math.abs(x - xCoord);

      if (distance < minDistance) {
        minDistance = distance;
        closestStem = stem;
      }
    }
    if (minDistance > threshold) return null
    return closestStem?.closest('.stem') || null;
  }

  widthOfBeam(polygon: SVGPolygonElement): number {
    const points = polygon.getAttribute('points');
    if (!points) return 0;

    const pointArr = points.split(' ').map(p => p.split(','));
    const x1 = parseFloat(pointArr[0][0]);
    const x2 = parseFloat(pointArr[1][0]);
    return Math.abs(x2 - x1);
  }

  redoBarLines() {
    const measures = this.svg.querySelectorAll('.measure');
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

  private getAnchorX(id: string): number | undefined {
    const noteId = id.replace(/^#/, '')
    const note = this.svg.querySelector<SVGElement>(`.note[data-id="${noteId}"]`)
    if (!note) return undefined
    return this.getOriginalX(note)
  }

  redoAnchored() {
    // Shift dynamics: <use> with translate
    for (const dynam of this.svg.querySelectorAll<SVGElement>('.dynam[data-startid]')) {
      const startid = dynam.getAttribute('data-startid')
      if (!startid) continue

      const noteX = this.getAnchorX(startid)
      if (noteX === undefined) continue

      const use = dynam.querySelector('use')
      if (!use) continue

      const transform = use.getAttribute('transform') || ''
      const data = parseTranslate(transform)
      if (!data) continue

      const newTransform = transform.replace(data.regex, `translate(${noteX}, ${data.y})`)
      use.setAttribute('transform', newTransform)
    }

    // Shift dirs: <text> with x attribute
    for (const dir of this.svg.querySelectorAll<SVGElement>('.dir[data-startid]')) {
      const startid = dir.getAttribute('data-startid')
      if (!startid) continue

      const noteX = this.getAnchorX(startid)
      if (noteX === undefined) continue

      const text = dir.querySelector('text')
      if (!text) continue

      text.setAttribute('x', noteX.toString())
    }

    // Shift hairpins: <polyline> with points
    for (const hairpin of this.svg.querySelectorAll<SVGElement>('.hairpin[data-startid]')) {
      const startid = hairpin.getAttribute('data-startid')
      if (!startid) continue

      const startX = this.getAnchorX(startid)
      if (startX === undefined) continue

      const endid = hairpin.getAttribute('data-endid')
      const endX = endid ? this.getAnchorX(endid) : undefined

      const polyline = hairpin.querySelector('polyline')
      if (!polyline) continue

      const points = polyline.getAttribute('points')
      if (!points) continue

      // Hairpin points are: "x1,y1 x2,y2 x3,y3" where x1=x3 (open end), x2 (point end)
      const pointArr = points.trim().split(/\s+/).map(p => p.split(','))
      if (pointArr.length < 3) continue

      const origOpenX = parseFloat(pointArr[0][0])
      const origPointX = parseFloat(pointArr[1][0])

      // Determine which end is the start (point) and which is the open end
      // For crescendo: point is left (startid), open is right (endid)
      // For decrescendo: open is left (startid), point is right (endid)
      const pointIsLeft = origPointX < origOpenX

      if (pointIsLeft) {
        // crescendo: point=start, open=end
        const newPointX = startX
        const newOpenX = endX ?? origOpenX + (startX - origPointX)
        pointArr[0][0] = newOpenX.toString()
        pointArr[1][0] = newPointX.toString()
        pointArr[2][0] = newOpenX.toString()
      } else {
        // decrescendo: open=start, point=end
        const newOpenX = startX
        const newPointX = endX ?? origPointX + (startX - origOpenX)
        pointArr[0][0] = newPointX.toString()
        pointArr[1][0] = newOpenX.toString()
        pointArr[2][0] = newPointX.toString()
      }

      polyline.setAttribute('points', pointArr.map(p => p.join(',')).join(' '))
    }
  }

  tiedNotesOf(note: SVGElement) {
    const id = note.getAttribute('data-id')

    const result = []
    let tie = this.svg.querySelector(`.tie[data-startid="#${id}"]`)
    while (tie) {
      const endid = tie.getAttribute('data-endid')
      if (!endid) break

      const endNote = this.svg.querySelector(`.note[data-id="${endid.slice(1)}"]`) as SVGElement | null
      if (endNote) result.push(endNote)

      tie = this.svg.querySelector(`.tie[data-startid="${endid}"]`)
    }

    return result
  }

  private getLedgerDashesFor(note: SVGElement): SVGPathElement[] {
    const id = note.getAttribute('data-id')
    if (!id) return Array.from(this.svg.querySelectorAll('.lineDash'))

    return Array
      .from(this.svg.querySelectorAll(`.lineDash[data-related]`))
      .filter(dash => dash.getAttribute('data-related')?.split(' ').includes(`#${id}`))
      .map(dash => dash.querySelector('path'))
      .filter(path => !!path)
  }

  private isEndOfTie(svgNote: SVGElement): boolean {
    const id = svgNote.getAttribute('data-id')
    if (!id) return false
    const tie = this.svg.querySelector(`.tie[data-endid="#${id}"]`)
    return !!tie
  }

  private multiplyLedgerLines() {
    for (const dash of this.svg.querySelectorAll('.lineDash[data-related]')) {
      const related = dash.getAttribute('data-related')
      if (!related) continue

      const ids = related.split(' ')
      if (ids.length <= 1) continue

      // Clone the ledger line for each note, each copy references only one note
      for (const id of ids) {
        const clone = dash.cloneNode(true) as SVGElement
        clone.setAttribute('data-related', id)
        dash.parentNode!.insertBefore(clone, dash)
      }
      dash.remove()
    }
  }

  run(toolkit: VerovioToolkit) {
    this.prepareBeamPolygons();

    // displace notes based on matched pairs
    this.multiplyStems();
    this.multiplyLedgerLines();

    let lastDiff: number | undefined = undefined
    for (const svgNote of this.svg.querySelectorAll<SVGElement>('.note')) {
      const xmlId = svgNote.getAttribute('data-id')
      if (!xmlId) continue

      if (this.isEndOfTie(svgNote)) {
        console.log('Skipping end of tie note', xmlId);
        continue
      }

      const span = this.getSpanForNote(xmlId)
      if (!span) {
        // Get original x of the last matched note, 
        // calculate the distance to its new position,
        // then shift the unmachted notes by that amount.

        if (lastDiff === undefined) {
          continue
        }

        const origX = this.getOriginalX(svgNote);
        if (!origX) continue
        this.shiftNote(svgNote, origX + lastDiff);

        svgNote.setAttribute('fill', 'darkred');
        svgNote.setAttribute('fill-opacity', '0.5');

        const endNotes = this.tiedNotesOf(svgNote)
        for (const endNote of endNotes) {
          if (endNote) {
            // If the note is tied, we also need to shift the end note
            const origX = this.getOriginalX(endNote);
            if (!origX) continue
            this.shiftNote(endNote, origX + lastDiff || 0);
            endNote.setAttribute('fill', 'darkred');
            endNote.setAttribute('fill-opacity', '0.5');
          }
        }
        continue
      }

      // set the opacity according to the velocity
      if ('velocity' in span) {
        this.changeOpacity(svgNote, span.velocity)
      }

      // set the X position based on the onset time
      const newX = span.onsetMs * this.stretchX
      lastDiff = newX - (this.getOriginalX(svgNote) || 0)
      this.shiftNote(svgNote, newX)

      // Move the second note of a tie and set its
      // opacity based on the velocity
      const endNotes = this.tiedNotesOf(svgNote)
      for (const endNote of endNotes) {
        const endId = endNote.getAttribute('data-id')
        if (!endId) continue

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const symbolicOnset = (toolkit.getTimesForElement(endId) as any).tstampOn[0]

        let endX: number | undefined = undefined
        for (const otherNote of this.svg.querySelectorAll('.note')) {
          const otherId = otherNote.getAttribute('data-id')
          if (!otherId) continue

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const otherOnset = (toolkit.getTimesForElement(otherId) as any).tstampOn[0]
          if (otherOnset === symbolicOnset && otherId !== endId) {
            const newOtherX = this.getSpanForNote(otherId)
            if (newOtherX !== undefined) {
              const candidate = newOtherX.onsetMs * this.stretchX
              if (endX === undefined || candidate < endX) {
                endX = candidate
              }
            }
            else if (endX === undefined) {
              // There is a note with the same symbolic onset,
              // but it has no span (yet). In that case, we 
              // draw a tie with an unspecified end.
              endX = newX + 700;
              endNote.style.display = 'none'
            }
          }
        }

        if (endX === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const times = toolkit.getTimesForElement(xmlId) as any
          const [num1, denom1] = times.qfracDuration[0]
          const [num2, denom2] = times.qfracTiedDuration[0]
          const dur = num1 / denom1
          const tied = num2 / denom2
          const share = dur / (dur + tied)
          endX = newX + share * (span.offsetMs - span.onsetMs) * this.stretchX
        }

        if (endX <= newX) {
          console.log('end x is before start x, how sad. Eliminate any traces of me failing');
          endNote?.remove();
          const tie = this.svg.querySelector(`.tie[data-startid="#${xmlId}"]`);
          tie?.remove()
          continue
        }
        else {
          this.shiftNote(endNote, endX);
        }

        if ('velocity' in span) {
          this.changeOpacity(endNote, span.velocity)
        }
      }
    }

    this.redoTies();
    this.redoBeams();
    this.redoBarLines();
    this.redoAnchored();
    this.svg.setAttribute('data-modified', 'true');
  }

  private stemToNoteId(stem: Element): string | null {
    // If stem is inside a .note, use that note's data-id
    const note = stem.closest('.note');
    if (note) return note.getAttribute('data-id');

    // If stem is inside a .chord, use the first .note's data-id
    const chord = stem.closest('.chord');
    if (chord) {
      const firstNote = chord.querySelector('.note');
      return firstNote?.getAttribute('data-id') || null;
    }
    return null;
  }

  // This must run before any stems are shifted
  prepareBeamPolygons() {
    if (this.svg.hasAttribute('data-modified')) {
      console.warn('SVG has already been modified, skipping beam polygon preparation.');
      return;
    }

    // for each beam, find the first and last note
    // and set the points of the polygon to those notes
    const beams = this.svg.querySelectorAll('.beam');
    for (const beam of beams) {
      const stems = beam.querySelectorAll<SVGPathElement>('.stem path');

      // One stem, but a beam? That doesn't make sense.
      if (stems.length < 2) continue;

      const polygons = beam.querySelectorAll('polygon');
      polygons.forEach(polygon => {
        const points = polygon.getAttribute('points');
        if (!points) return;

        const pointArr = points.split(' ').map(p => p.split(','));
        if (pointArr.length < 4) return;

        const x1 = parseFloat(pointArr[0][0]);
        const x2 = parseFloat(pointArr[1][0]);

        // find the closest stem to the left and right
        const left = this.findClosestStem(x1, Array.from(stems));
        const right = this.findClosestStem(x2, Array.from(stems));

        if (left && right) {
          const leftNote = this.stemToNoteId(left);
          const rightNote = this.stemToNoteId(right);
          if (leftNote && rightNote) {
            polygon.setAttribute('data-left-note', leftNote);
            polygon.setAttribute('data-right-note', rightNote);
          }
        }
        else {
          // if no stem are found, define relative placements instead
          const firstStem = stems[0];
          const lastStem = stems[stems.length - 1];
          const firstX = this.getXOfStem(firstStem)
          const lastX = this.getXOfStem(lastStem)
          if (firstX === undefined || lastX === undefined) return;
          const fullDistance = lastX - firstX;
          const relativeLeft = (x1 - firstX) / fullDistance;
          const relativeRight = (x2 - firstX) / fullDistance;
          polygon.setAttribute('data-relative-left', relativeLeft.toString());
          polygon.setAttribute('data-relative-right', relativeRight.toString());
        }
      })
    }
  }


}

const convertRange = (value: number, r1: [number, number], r2: [number, number]) => {
  return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
}
