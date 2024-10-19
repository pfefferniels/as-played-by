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
}

export const MidiViewer = ({ file, toSVG, height, highlight }: MidiViewerProps) => {
    // const { playSingleNote } = usePiano()
    const [spans, setSpans] = useState<AnySpan[]>([])

    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        setSpans(asSpans(file, true))
    }, [file])

    const lastOffsetMs = Math.max(...spans.map(span => span.offsetMs))
    const lastPoint = toSVG([lastOffsetMs || 0, 0])

    return (
        <svg width={lastPoint[0] + 100} height={height} ref={svgRef}>
            {spans.map((span, i) => {
                if (span.type === 'note') {
                    return (
                        <Note
                            key={`span_${i}`}
                            toSVG={toSVG}
                            span={span}
                            highlight={span.id === highlight?.id}
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

const Note = ({ toSVG, span, highlight }: { toSVG: (point: Point) => Point, span: NoteSpan, highlight: boolean }) => {
    const point1 = toSVG([span.onsetMs, span.pitch])
    const point2 = toSVG([span.offsetMs, span.pitch])

    return (
        <rect
            className='midiNote'
            fill={span.channel === 1 ? 'red' : 'blue'}
            strokeWidth={highlight ? 7 : 0.5}
            stroke="black"
            x={point1[0]}
            y={point1[1]}
            width={point2[0] - point1[0]}
            height={5}
        />
    )
}

