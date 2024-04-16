import { MidiFile } from "midifile-ts";
import { useEffect, useState } from "react";
import { MidiNote, asNotes } from "./MidiNote";

export type Point = [number, number]

interface MidiViewerProps {
    file: MidiFile
    toSVG: (point: Point) => Point
    height: number
    onClick: (note: MidiNote) => void
}

export const MidiViewer = ({ file, toSVG, onClick, height }: MidiViewerProps) => {
    const [notes, setNotes] = useState<MidiNote[]>([])

    useEffect(() => {
        setNotes(asNotes(file))
    }, [file])

    const lastPoint = toSVG([notes[notes.length - 1]?.offsetMs || 0, 0])

    return (
        <svg width={lastPoint[0]} height={height}>
            {notes.map((note, i) => {
                const point1 = toSVG([note.onsetMs, note.pitch])
                const point2 = toSVG([note.offsetMs, note.pitch])

                return (
                    <rect
                        className='midiNote'
                        key={`note_${i}`}
                        fill={note.channel === 1 ? 'red' : 'blue'}
                        x={point1[0]}
                        y={point1[1]}
                        width={point2[0] - point1[0]}
                        height={5}
                        onClick={() => onClick(note)} />
                )
            })}
        </svg>
    )
}