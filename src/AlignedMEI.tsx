import { useState, useEffect, useLayoutEffect } from "react";
import { VerovioToolkit } from "verovio/esm";
import { loadVerovio } from "./loadVerovio.mts";

function convertRange( value: number, r1: [number, number], r2: [number, number] ) { 
    return ( value - r1[ 0 ] ) * ( r2[ 1 ] - r2[ 0 ] ) / ( r1[ 1 ] - r1[ 0 ] ) + r2[ 0 ];
}

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

const shiftStem = (stem: Element, newX: number) => {
    const d = stem.getAttribute('d')
    if (!d) return

    const points = d.split(' ')
    const y1 = +points[1]
    const y2 = +points[3]

    const shift = +(stem.getAttribute('data-shift-notehead') || 0)
    stem.setAttribute('d', `M${newX - shift} ${y1} L${newX - shift} ${y2}`)
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

interface AlignedMEIProps {
    mei: Document
    onClick: (id: string) => void
    toSVG: (point: [number, number]) => [number, number]
}

export const AlignedMEI = ({ mei, onClick, toSVG }: AlignedMEIProps) => {
    const [vrvToolkit, setVrvToolkit] = useState<VerovioToolkit>();
    const [svg, setSVG] = useState<string>('');

    useEffect(() => {
        loadVerovio().then(tk => setVrvToolkit(tk));
    }, []);

    useLayoutEffect(() => {
        if (!vrvToolkit) return

        document.querySelectorAll('.note').forEach(note => {
            note.addEventListener('click', () => {
                onClick(note.getAttribute('id') || 'unknown')
            })
        })

        addShiftInfo()

        const svg = document.querySelector('#scoreDiv svg')
        if (svg) {
            const width = svg.getAttribute('viewBox')?.split(' ')[2]
            svg.setAttribute('width', width ? (+width / 2.5).toString() : '2000')
        }

        // TODO: displace notes based on <when> elements
        const whens = mei.querySelectorAll('when')
        for (const when of whens) {
            const onsetTime = +((when.getAttribute('absolute') || '').replace('ms', ''))
            const duration = +((when.querySelector('extData[type="duration"]')?.textContent || '0').replace('ms', ''))
            if (!onsetTime) continue

            const velocity = when.querySelector('extData[type="velocity"]')?.textContent
            if (!velocity) continue

            const notes = when.getAttribute('data')?.split(' ').map(ref => document.querySelector(ref))
            if (!notes) continue

            for (const note of notes) {
                if (!note) continue

                const use = note.querySelector('use')
                if (!use) continue

                // set the opacity according to the velocity
                note.querySelectorAll('use,path').forEach(path => {
                    path.setAttribute('fill-opacity', convertRange(+velocity, [30, 55], [0.2, 1]).toString())
                    path.setAttribute('stroke-opacity', convertRange(+velocity, [30, 55], [0.2, 1]).toString())
                })

                // make sure that tied notes have the opacity

                const id = note.getAttribute('id')
                if (!id) {
                    console.log('No id found for element, skipping element', note)
                    continue
                }
                // console.log('moving', note, 'to', +onsetTime)

                const newX = (toSVG([+onsetTime, 0])[0] * 20)

                use.setAttribute('x', newX.toString())

                const tie = [...mei.querySelectorAll('tie')].find(tie => tie.getAttribute('startid') === `#${id}`)
                if (tie) {
                    // the note is part of a tie. Find the end note
                    const endid = tie.getAttribute('endid')
                    const endNote = document.querySelector(endid || 'unknown')
                    if (endNote) {
                        const times = vrvToolkit.getTimesForElement(id)
                        const share = (times.scoreTimeDuration - times.scoreTimeTiedDuration) / times.scoreTimeDuration
                        const endX = (newX + share * toSVG([+duration, 0])[0] * 10)

                        const endUse = endNote.querySelector('use')
                        if (endUse && !isNaN(share)) {
                            endUse.setAttribute('x', endX.toString())
                        }

                        const stem = endNote.querySelector('.stem path')
                        if (stem) shiftStem(stem, endX)
                    }
                }

                let stem = note.querySelector('.stem path');
                if (!stem && note.closest('.chord')) {
                    // we might be dealing with a chord
                    const chordStem = note.closest('.chord')!.querySelector('.stem')
                    if (chordStem) {
                        const newStem = chordStem.cloneNode(true)
                        note.appendChild(newStem)
                        stem = note.querySelector('.stem path')
                        if (stem) {
                            const d = stem?.getAttribute('d')?.split(' ')
                            if (d) {
                                d[1] = use.getAttribute('y') || '0'
                                stem?.setAttribute('d', d?.join(' '))
                            }
                        }
                    }
                }
                if (stem) shiftStem(stem, newX)
            }
        }

        // redo the beams
        const beams = document.querySelectorAll('.beam')
        for (const beam of beams) {
            // get the x's of the first and the last stem
            const stems = beam.querySelectorAll('.note .stem path')
            if (stems.length <= 1) continue

            const stem1 = stems[0]
            const stem2 = stems[stems.length - 1]

            const x1 = stem1.getAttribute('d')?.split(' ')[0].slice(1)
            const x2 = stem2.getAttribute('d')?.split(' ')[0].slice(1)
            // console.log('beam from', x1, 'to', x2)

            const polygon = beam.querySelector('polygon')
            const points = polygon?.getAttribute('points')
            if (!points) continue

            const pointArr = points.split(' ').map(p => p.split(','))
            polygon?.setAttribute('points', `${x1},${pointArr[0][1]} ${x2},${pointArr[1][1]} ${x2},${pointArr[2][1]} ${x1},${pointArr[3][1]}`)
        }

        // redo ties
        const ties = document.querySelectorAll('.tie')
        for (const tie of ties) {
            const path = tie.querySelector('path')
            if (!path) {
                console.log('No path found for tie')
                continue
            }

            const startUse = document.querySelector(`${tie.getAttribute('data-startid')} use`)
            const endUse = document.querySelector(`${tie.getAttribute('data-endid')} use`)
            if (!startUse || !endUse) continue

            const x1 = +(startUse.getAttribute('x') || 0) + 300
            const x2 = +(endUse.getAttribute('x') || 0) - 80
            const middleX1 = x1 + (x2 - x1) * 0.25
            const middleX2 = x1 + (x2 - x1) * 0.75


            const points = path.getAttribute('d')?.split(' ')
            if (!points || points.length < 5) {
                console.log('Something is wrong with the control points')
                continue
            }

            const y1 = points[0].split(',')[1]
            const middlePoints = [+points[1].split(',')[1], +points[4].split(',')[1]]
            const middleY1 = Math.max(...middlePoints)
            const middleY2 = Math.min(...middlePoints)

            path.setAttribute('d', `M${x1},${y1} C${middleX1},${middleY1} ${middleX2},${middleY1} ${x2},${y1} C${middleX2},${middleY2} ${middleX1},${middleY1} ${x1},${y1}`)
        }

        // remove all chord stems
        document.querySelectorAll('.chord>.stem').forEach(el => el.remove())

        // place bar lines
        const measures = document.querySelectorAll('.measure')
        for (let i = 0; i < measures.length - 1; i++) {
            // find the last x in this measure and the first x in the next
            const currentMeasure = measures[i]
            const nextMeasure = measures[i + 1]

            // console.log('current measure', currentMeasure.getAttribute('data-n'))
            // console.log('next measure', nextMeasure.getAttribute('data-n'))

            const maxX = Math.max(
                ...[...currentMeasure.querySelectorAll('.notehead use')]
                    .filter(use => {
                        const note = use.closest('.note')
                        if (!note) return false
                        return !document.querySelector(`.tie[data-endid="#${note.getAttribute('id')}"]`) &&
                            mei.querySelector(`when[data="#${note.getAttribute('id')}"]`)
                    })
                    .map(use => +(use.getAttribute('x') || 0)))
            const minX = Math.min(
                ...[...nextMeasure.querySelectorAll('.notehead use')]
                    .filter(use => {
                        const note = use.closest('.note')
                        if (!note) return false
                        return !document.querySelector(`.tie[data-endid="#${note.getAttribute('id')}"]`) &&
                            mei.querySelector(`when[data="#${note.getAttribute('id')}"]`)
                    })
                    .map(use => +(use.getAttribute('x') || 0))
            )

            // console.log('avarage of', maxX, minX)

            const avgX = (maxX + minX) / 2 + 100

            currentMeasure.querySelectorAll('.barLine path').forEach(line => {
                const d = line.getAttribute('d')?.split(' ')
                if (!d) return
                line.setAttribute('d', `M${avgX} ${d[1]} L${avgX} ${d[3]}`)
            })
        }

        const allNotes = document.querySelectorAll('.note')
        for (const note of allNotes) {
            const correspWhen = [...whens].find(when => when.getAttribute('data')?.includes(note.getAttribute('id')!))
            if (!correspWhen) {
                // TODO: place between 
                note.setAttribute('fill', 'orange')
            }
        }
    }, [svg, onClick, mei, toSVG, vrvToolkit])

    useEffect(() => {
        if (!vrvToolkit) return

        const text = new XMLSerializer().serializeToString(mei)
        vrvToolkit.setOptions({
            adjustPageHeight: true,
            adjustPageWidth: true,
            breaks: 'none',
            svgViewBox: true,
            svgAdditionalAttribute: ['tie@startid', 'tie@endid', 'measure@n']
        });
        vrvToolkit.loadData(text);
        setSVG(vrvToolkit.renderToSVG(1));

    }, [mei, vrvToolkit])

    return (
        <div id='scoreDiv' style={{ width: '90vw', overflow: 'scroll' }} dangerouslySetInnerHTML={{ __html: svg }} />
    )
}
