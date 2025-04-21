import { useState, useEffect, useLayoutEffect } from "react";
import { VerovioToolkit } from "verovio/esm";
import { loadVerovio } from "./loadVerovio.mts";
import { usePiano } from "react-pianosound";
import { AnySpan } from "./MidiSpans";

// function convertRange(value: number, r1: [number, number], r2: [number, number]) {
//     return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
// }

const addShiftInfo = () => {
    document.querySelectorAll('.stem path, .accid path, .flag path').forEach(el_ => {
        const el = el_ as SVGGraphicsElement
        let note = el.closest('.note')
        if (!note) {
            const chord = el.closest('.chord')
            if (!chord) return
            note = chord.querySelector('.note')
            if (!note) return
        }

        const notehead = note.querySelector('.notehead') as SVGGraphicsElement
        const noteheadX = notehead.getBBox().x
        const stemX = el.getBBox().x
        el.setAttribute('data-shift-notehead', (noteheadX - stemX).toString())
    })
}

const shiftStem = (note: SVGElement, newX: number) => {
    let stem = note.querySelector('.stem path')
    if (!stem && note.closest('.chord')) {
        // we might be dealing with a chord: 
        // try to simulate a note stem
        const chordStem = note.closest('.chord')!.querySelector('.stem')
        if (chordStem) {
            const newStem = chordStem.cloneNode(true)
            note.appendChild(newStem)
            stem = note.querySelector('.stem path')
            if (stem) {
                const d = stem?.getAttribute('d')?.split(' ')
                if (d) {
                    d[1] = note.querySelector('use')!.getAttribute('y') || '0'
                    stem?.setAttribute('d', d?.join(' '))
                }
            }
        }
    }

    // do not continue if the stem simulation failed
    if (!stem) return

    const d = stem.getAttribute('d')
    if (!d) return

    const points = d.split(' ')
    const y1 = +points[1]
    const y2 = +points[3]

    const shift = +(stem.getAttribute('data-shift-notehead') || 0)
    stem.setAttribute('d', `M${newX - shift} ${y1} L${newX - shift} ${y2}`)
}

const shiftNote = (note: SVGElement, newX: number) => {
    const use = note.querySelector('use')
    if (!use) return

    if (note.hasAttribute('data-original')) {
        console.log('shifting twice ...')
    }

    use.setAttribute('x', newX.toString())
}

const tiedNoteOf = (note: SVGElement) => {
    const id = note.getAttribute('id')
    const tie = document.querySelector(`.tie[data-startid="#${id}"]`)
    console.log('tie', tie)
    if (!tie) return null


    // the note is part of a tie. Find the end note
    const endid = tie.getAttribute('data-endid')
    console.log('endid', endid)
    if (!endid) return null

    return document.querySelector(endid) as SVGElement | null
}

//const shiftFlag = (flag: Element, newX: number) => {
//    const d = flag.getAttribute('d')
//    if (!d) return
//
//    const points = d.split(' ')
//    const y1 = +points[1]
//    const y2 = +points[3]
//
//    const shift = +(stem.getAttribute('data-shift-notehead') || 0)
//    stem.setAttribute('d', `M${newX - shift} ${y1} L${newX - shift} ${y2}`)
//}

// const changeOpacity = (note: SVGElement, newValue: number, originalRange: [number, number] = [30, 50]) => {
//     note.querySelectorAll('use,path').forEach(path => {
//         path.setAttribute('fill-opacity', convertRange(+newValue, originalRange, [0.2, 1]).toString())
//         path.setAttribute('stroke-opacity', convertRange(+newValue, originalRange, [0.2, 1]).toString())
//     })
// }

interface AlignedMEIProps {
    mei: string
    getSpanForNote: (id: string) => AnySpan | 'deletion' | undefined
    toSVG: (point: [number, number]) => [number, number]
    highlight?: string
    onClick: (id: string) => void
}

export const AlignedMEI = ({ mei, getSpanForNote, toSVG, highlight, onClick }: AlignedMEIProps) => {
    const { playSingleNote } = usePiano()
    const [vrvToolkit, setVrvToolkit] = useState<VerovioToolkit>();
    const [svg, setSVG] = useState<string>('');

    useEffect(() => {
        loadVerovio().then(tk => setVrvToolkit(tk));
    }, []);

    useLayoutEffect(() => {
        if (!vrvToolkit) return

        const svg = document.querySelector('#scoreDiv svg') as SVGElement
        if (svg) {
            const width = svg.getAttribute('viewBox')?.split(' ')[2]
            svg.setAttribute('width', width ? (+width / 2.5).toString() : '2000')

            // hide certain notes
            const elementsToHide = svg.querySelectorAll('.clef, .meterSig, .ledgerLines, .flag, .dots, .rest, .accid, .fermata, .artic, .slur, .hairpin, .tempo, .fermata, .dynam, .dir, .barLine');
            elementsToHide.forEach(el => {
                (el as SVGGraphicsElement).style.display = 'none';
            });
        }

        addShiftInfo()

        if (highlight) {
            const el = document.querySelector(`#${highlight}`)
            if (el) {
                el.setAttribute('fill', 'red')
            }
        }

        // displace notes based on matched pairs
        const meiDoc = new DOMParser().parseFromString(mei, 'application/xml')
        const notes = meiDoc.querySelectorAll('note')

        let lastSpan: AnySpan | undefined = undefined
        for (const note of notes) {
            const xmlId = note.getAttribute('xml:id')
            if (!xmlId) continue

            const svgNote = svg?.querySelector(`[id="${xmlId}"]`) as SVGElement | null
            if (!svgNote) {
                console.log('No corresponding SVG note found for', xmlId)
                continue
            }

            svgNote.addEventListener('click', () => onClick(xmlId))

            const span = getSpanForNote(xmlId)
            if (!span) {
                continue
            }
            else if (span === 'deletion') {
                if (lastSpan) {
                    shiftNote(svgNote, toSVG([lastSpan.onsetMs, 0])[0] * 20)
                }

                svgNote.setAttribute('fill', 'red');
                continue
            }
            lastSpan = span

            const use = svgNote.querySelector('use') as SVGUseElement | null
            if (!use) continue

            // set the opacity according to the velocity
            // changeOpacity(svgNote, span.velocity)

            // set the X position based on the onset time and
            // store the original value.
            const newX = toSVG([span.onsetMs, 0])[0] * 20
            shiftNote(svgNote, newX)
            note.querySelector('use')?.setAttribute('data-original', use.getAttribute('x') || '0')                // console.log(onsetTime, '=>', newX)
            note.setAttribute('data-onset', span.onsetMs.toString())
            shiftStem(svgNote, newX)

            // Move the second note of a tie and set its
            // opacity based on the velocity
            const endNote = tiedNoteOf(svgNote)
            if (endNote) {
                const times = vrvToolkit.getTimesForElement(xmlId)
                const share = (times.scoreTimeDuration - times.scoreTimeTiedDuration) / times.scoreTimeDuration
                const endX = (newX + share * toSVG([span.offsetMs - span.onsetMs, 0])[0] * 10)

                const endUse = endNote.querySelector('use') as SVGUseElement | null
                if (endUse && !isNaN(share)) {
                    endUse.setAttribute('data-original', endUse.getAttribute('x')!)
                    endUse.setAttribute('x', endX.toString())
                }
                shiftStem(endNote, endX)
                // changeOpacity(endNote, +velocity)
            }
        }

        // remove all chord stems
        document.querySelectorAll('.chord>.stem').forEach(el => el.remove())

        const shiftedNotes = [...document.querySelectorAll(`.note use[data-original]`)]
        const outermostX = Math.max(...shiftedNotes.map(n => +(n.getAttribute('x') || 0)))
        const originalX = Math.max(...shiftedNotes.map(n => +(n.getAttribute('data-original') || 0)))
        const shift = outermostX - originalX

        if (!isNaN(shift) && shift > 0) {
            const unshiftedNotes = document.querySelectorAll(`.note use:not([data-original])`)
            for (const unshiftedNoteUse of unshiftedNotes) {
                const unshiftedNote = unshiftedNoteUse.closest('.note')!
                // console.log('unshifted note', unshiftedNoteUse)
                if (unshiftedNote.getAttribute('id') === 'nccsrf2') {
                    console.log('encountered 2',
                        unshiftedNote.getAttribute('data-onset'),
                        unshiftedNote.querySelector('use')?.getAttribute('x'))
                    unshiftedNote.querySelector('use')?.getAttribute('data-original')
                }

                const x = +(unshiftedNoteUse.getAttribute('x') || 0)
                const newX = shift + x

                console.log(unshiftedNote.getAttribute('data-onset'))

                console.log('shifting', unshiftedNote, 'further by', newX)

                shiftNote(unshiftedNote as SVGElement, newX)
                shiftStem(unshiftedNote as SVGElement, newX)
            }
        }

        redoBeams();
        redoTies();
        redoBarLines(meiDoc);
    }, [svg, mei, toSVG, vrvToolkit, getSpanForNote, highlight, playSingleNote, onClick])

    useEffect(() => {
        if (!vrvToolkit) return

        vrvToolkit.setOptions({
            adjustPageHeight: true,
            adjustPageWidth: true,
            breaks: 'none',
            svgViewBox: true,
            svgAdditionalAttribute: ['tie@startid', 'tie@endid', 'measure@n', 'layer@n'],
            appXPathQuery: ['./rdg[contains(@source, "performance")]']
        });
        vrvToolkit.loadData(mei);
        vrvToolkit.renderToMIDI()
        setSVG(vrvToolkit.renderToSVG(1));

    }, [mei, vrvToolkit])

    return (
        <div id='scoreDiv' style={{ width: '90vw', overflow: 'scroll' }} dangerouslySetInnerHTML={{ __html: svg }} />
    )
}

function redoBarLines(mei: Document) {
    const measures = document.querySelectorAll('.measure');
    for (let i = 0; i < measures.length - 1; i++) {
        // find the last x in this measure and the first x in the next
        const currentMeasure = measures[i];
        const nextMeasure = measures[i + 1];

        // console.log('current measure', currentMeasure.getAttribute('data-n'))
        // console.log('next measure', nextMeasure.getAttribute('data-n'))
        const maxX = Math.max(
            ...[...currentMeasure.querySelectorAll('.notehead use')]
                .filter(use => {
                    const note = use.closest('.note');
                    if (!note) return false;
                    return !document.querySelector(`.tie[data-endid="#${note.getAttribute('id')}"]`) &&
                        mei.querySelector(`when[data="#${note.getAttribute('id')}"]`);
                })
                .map(use => +(use.getAttribute('x') || 0)));
        const minX = Math.min(
            ...[...nextMeasure.querySelectorAll('.notehead use')]
                .filter(use => {
                    const note = use.closest('.note');
                    if (!note) return false;
                    return !document.querySelector(`.tie[data-endid="#${note.getAttribute('id')}"]`) &&
                        mei.querySelector(`when[data="#${note.getAttribute('id')}"]`);
                })
                .map(use => +(use.getAttribute('x') || 0))
        );

        const avgX = (maxX + minX) / 2 + 100;

        currentMeasure.querySelectorAll('.barLine path').forEach(line => {
            const d = line.getAttribute('d')?.split(' ');
            if (!d) return;
            line.setAttribute('d', `M${avgX} ${d[1]} L${avgX} ${d[3]}`);
        });
    }
}

function redoTies() {
    console.log('redo ties')
    const ties = document.querySelectorAll('.tie');
    for (const tie of ties) {
        const path = tie.querySelector('path');
        if (!path) {
            console.log('No path found for tie');
            continue;
        }

        const startUse = document.querySelector(`${tie.getAttribute('data-startid')} use`);
        const endUse = document.querySelector(`${tie.getAttribute('data-endid')} use`);
        if (!startUse || !endUse) continue;

        const x1 = +(startUse.getAttribute('x') || 0) + 300;
        const x2 = +(endUse.getAttribute('x') || 0) - 80;
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

function redoBeams() {
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

