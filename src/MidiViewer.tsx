import { useRef, useState } from "react";
import { AnySpan, NoteSpan } from "./MidiSpans";
import { usePiano } from "react-pianosound";
// import { usePiano } from "react-pianosound"

export type Point = [number, number]

interface MidiViewerProps {
    spans: AnySpan[]
    toSVG: (point: Point) => Point
    height: number
    highlight?: AnySpan
    onClick: (span: AnySpan, e: React.MouseEvent) => void
}

export const MidiViewer = ({ spans, toSVG, height, highlight, onClick }: MidiViewerProps) => {
    const svgRef = useRef<SVGSVGElement>(null)

    if (spans.length === 0) return null

    spans.sort((a, b) => {
            return a.onsetMs - b.onsetMs;
        })

    const leftX = toSVG([spans[0].onsetMs, 0])[0]
    const lastOffsetMs = Math.max(...spans.map(span => span.offsetMs))
    const lastPoint = toSVG([lastOffsetMs || 0, 0])

    return (
        <svg
            width={lastPoint[0] + 100}
            height={height}
            ref={svgRef}
            style={{ position: 'absolute', top: 0, left: leftX }}
        >
            <defs>
                <linearGradient id="timeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop
                        offset="0%"
                        stopColor="white"
                        stopOpacity={0.5}
                    />
                    <stop
                        offset={`${Math.min(1, 2000 / (lastOffsetMs - (spans[0]?.onsetMs || 0))) * 100}%`}
                        stopColor="white"
                        stopOpacity={1}
                    />
                    <stop
                        offset="100%"
                        stopColor="white"
                        stopOpacity={1}
                    />
                </linearGradient>
            </defs>

            {spans.length > 1 && (
                <rect
                    x={0}
                    y={0}
                    width={toSVG([lastOffsetMs, 0])[0] - toSVG([spans[0].onsetMs, 0])[0]}
                    height={height}
                    fill="url(#timeGradient)"
                />
            )}

            {spans.map((span, i) => {
                if (span.type === 'note') {
                    return (
                        <Note
                            key={`span_${i}`}
                            toSVG={([x, y]) => toSVG([x - spans[0].onsetMs, y])}
                            span={span}
                            highlight={span.id === highlight?.id}
                            onClick={e => onClick(span, e)}
                        />
                    )
                } else {
                    // TODO
                }
            })}

            {spans.length > 0 && (
                <line
                    x1={2}
                    y1={0}
                    x2={2}
                    y2={height}
                    stroke="black"
                    strokeWidth={3}
                    strokeDasharray={"10,0"}
                />
            )}
        </svg>
    )
}

interface NoteProps {
    toSVG: (point: Point) => Point
    span: NoteSpan
    highlight: boolean
    onClick: React.MouseEventHandler
}

const Note = ({ toSVG, span, highlight, onClick }: NoteProps) => {
    const [hovered, setHovered] = useState(false)

    const { playSingleNote, stop } = usePiano()

    const point1 = toSVG([span.onsetMs, span.pitch])
    const point2 = toSVG([span.offsetMs, span.pitch])

    return (
        <rect
            className='midiNote'
            fill={hovered ? 'red' : 'rgba(0, 0, 0, 0.8)'}
            strokeWidth={hovered ? 2 : highlight ? 7 : 0.5}
            stroke={hovered ? 'black' : 'gray'}
            x={point1[0]}
            y={point1[1]}
            width={point2[0] - point1[0]}
            height={7}
            onClick={onClick}
            onMouseEnter={() => {
                playSingleNote(span.pitch, (span.offsetMs - span.onsetMs))
                setHovered(true)
            }}
            onMouseLeave={() => {
                stop()
                setHovered(false)
            }}
        />
    )
}

