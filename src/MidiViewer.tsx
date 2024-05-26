import { MidiFile } from "midifile-ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { MidiNote, asNotes } from "./MidiNote";
import { usePiano } from "react-pianosound"

export type Point = [number, number]

interface MidiViewerProps {
    file: MidiFile
    toSVG: (point: Point) => Point
    height: number
    onClick?: (note: MidiNote) => void
    onHover?: (ntoe: MidiNote) => void
    searchPitch?: number
}

export const MidiViewer = ({ file, toSVG, onClick, onHover, height, searchPitch }: MidiViewerProps) => {
    const { playSingleNote } = usePiano()
    const [notes, setNotes] = useState<MidiNote[]>([])
    const [noteToHighlight, setNoteToHighlight] = useState<string>()

    const svgRef = useRef<SVGSVGElement>(null)

    const samePitchPositions = useCallback(() => {
        const samePitch = notes
            .filter(note => note.pitch === searchPitch)
            .map(note => {
                return {
                    id: note.id,
                    x: toSVG([note.onsetMs, 0])[0]
                }
            })
        return samePitch
    }, [notes, searchPitch, toSVG])

    useEffect(() => {
        if (!svgRef.current) return

        svgRef.current.addEventListener('mousemove', (e) => {
            const bounds = svgRef.current!.getBoundingClientRect();
            const x = e.clientX - bounds.left;
            const candidates = samePitchPositions().map(p => ({ ...p, distance: Math.abs(x - p.x) }))
            const minDistance = Math.min(...candidates.map(candidate => candidate.distance))
            const id = candidates.find(c => c.distance === minDistance)?.id
            setNoteToHighlight(id)
        })
    }, [samePitchPositions])

    useEffect(() => {
        setNotes(asNotes(file, true))
    }, [file])

    const lastPoint = toSVG([notes[notes.length - 1]?.offsetMs || 0, 0])

    return (
        <svg width={lastPoint[0]} height={height} ref={svgRef}>
            {notes.map((note, i) => {
                const point1 = toSVG([note.onsetMs, note.pitch])
                const point2 = toSVG([note.offsetMs, note.pitch])

                return (
                    <rect
                        className='midiNote'
                        key={`note_${i}`}
                        fill={note.channel === 1 ? 'red' : 'blue'}
                        strokeWidth={noteToHighlight === note.id ? 7 : 0.5}
                        stroke="black"
                        x={point1[0]}
                        y={point1[1]}
                        width={point2[0] - point1[0]}
                        height={5}
                        onClick={() => {
                            playSingleNote(note.pitch)
                            onClick && onClick(note)
                        }}
                        onMouseOver={() => {
                            onHover && onHover(note)
                        }} />
                )
            })}
        </svg>
    )
}