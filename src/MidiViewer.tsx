import { MidiFile } from "midifile-ts";
import { useEffect, useRef, useState } from "react";
import { AnySpan, asSpans, NoteSpan } from "./MidiSpans";
// import { usePiano } from "react-pianosound"

export type Point = [number, number]

interface MidiViewerProps {
    file: MidiFile
    toSVG: (point: Point) => Point
    height: number
    highlight?: AnySpan
    isInsertion: (id: string) => boolean
}

export const MidiViewer = ({ file, toSVG, height, highlight, isInsertion }: MidiViewerProps) => {
    // const { playSingleNote } = usePiano()
    const [spans, setSpans] = useState<AnySpan[]>([])

    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        setSpans(asSpans(file, true))
    }, [file])

    const lastOffsetMs = spans.length > 0 ? Math.max(...spans.map(span => span.offsetMs)) : 1000
    const lastPoint = toSVG([lastOffsetMs, 0])

    return (
        <svg width={lastPoint[0] + 100} height={height} ref={svgRef}>
            {spans.map((span, i) => {
                const insertion = isInsertion(span.id)
                if (span.type === 'note') {
                    return (
                        <Note
                            key={`span_${i}`}
                            toSVG={toSVG}
                            span={span}
                            highlight={span.id === highlight?.id}
                            isInsertion={insertion}
                        />
                    )
                }
                else {
                    // TODO
                }
            })}
        </svg>
    )
}

interface NoteProps {
    toSVG: (point: Point) => Point
    span: NoteSpan
    highlight: boolean
    isInsertion: boolean
}

const Note = ({ toSVG, span, highlight, isInsertion }: NoteProps) => {
    const point1 = toSVG([span.onsetMs, span.pitch])
    const point2 = toSVG([span.offsetMs, span.pitch])

    return (
        <rect
            className='midiNote'
            fill={isInsertion ? 'red' : 'gray'}
            strokeWidth={isInsertion? 2 : highlight ? 7 : 0.5}
            stroke={isInsertion ? 'black' : 'gray'}
            x={point1[0]}
            y={point1[1]}
            width={point2[0] - point1[0]}
            height={5}
        />
    )
}

