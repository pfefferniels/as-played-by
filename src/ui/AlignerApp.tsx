import { MidiFile, read } from "midifile-ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnySpan, asSpans } from "../performance/midiSpans";
import { MidiViewer } from "./MidiViewer";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControl, IconButton, Slider, Stack, Tooltip, Typography } from "@mui/material"
import { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { PerformedScore } from "../verovio/PerformedScore";
import { DEFAULT_PERFORMANCE_SCALE, pixelsPerSecond } from "../verovio/toolkit";
import { CodeEditor } from "./CodeEditor";
import { Download, ExpandMore, Info, PlayCircle, StopCircle } from "@mui/icons-material";
import InfoDialog from "./Info";
import { getNotesFromMEI } from "../score/scoreNotes";
import { naiveAligner } from "../alignment/naiveAligner";
import type { Match } from "../alignment/types";
import { applyAlignment } from "../alignment/applyAlignment";
import { chosenFile, readAsArrayBuffer, readAsText } from "./fileInput";
import { usePiano } from "react-pianosound";

export const App = () => {
    const [mei, setMEI] = useState<string>()
    const [midi, setMIDI] = useState<MidiFile>()
    const [midiFileName, setMidiFileName] = useState<string>('')
    const [pairs, setPairs] = useState<Match[]>([])
    const [scale, setScale] = useState<number>(DEFAULT_PERFORMANCE_SCALE);
    const [showHelp, setShowHelp] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [selectedSpans, setSelectedSpans] = useState<AnySpan[]>([])

    const editorRef = useRef<ReactCodeMirrorRef>(null)
    const { play, playSingleNote, stop } = usePiano()

    useEffect(() => {
        const alertUser = (e: Event) => {
            e.preventDefault()
        }

        window.addEventListener('beforeunload', alertUser)
        return () => {
            window.removeEventListener('beforeunload', alertUser)
        }
    }, [])

    const handleMEI = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = chosenFile(event);
        if (!file) return;

        setMEI(await readAsText(file));
    };

    const handleMIDI = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = chosenFile(event);
        if (!file) return;

        setMidiFileName(file.name)
        setMIDI(read(await readAsArrayBuffer(file)));
    };

    useEffect(() => {
        if (!mei || !midi) return

        const perform = async () => {
            const notes = await getNotesFromMEI(mei);
            setPairs(naiveAligner(notes, asSpans(midi, true)))
            setSelectedSpans([])
        }
        perform()
    }, [mei, midi])

    /**
     * The score is laid out from the <when> elements of the MEI, so the current
     * matching is written into it before rendering - which means what is shown
     * while aligning is exactly the document that "Finalize" keeps.
     */
    const alignedMEI = useMemo(() => {
        if (!mei || !midi) return mei
        return applyAlignment(mei, midi, pairs)
    }, [mei, midi, pairs])

    const handleDownload = () => {
        if (!mei) return
        const blob = new Blob([mei], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'as-played-by.mei';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const scrollToRange = (left: number, right: number) => {
        if (!editorRef.current || !editorRef.current.state?.doc) {
            return
        }

        editorRef.current.view?.dispatch({
            selection: EditorSelection.single(left, right),
            scrollIntoView: true,
        })
    }

    // The piano roll of what could not be matched follows the axis of the score above it
    const toSVG = ([a, b]: [number, number]) =>
        [(a / 1000) * pixelsPerSecond({ performanceScale: scale }), (100 - b) * 8] as [number, number]

    const unmatchedSpans = (midi && pairs.length > 0)
        ? asSpans(midi, true)
            .filter(span => span.type === 'note')
            .sort((a, b) => a.onsetMs - b.onsetMs)
            .filter(span => {
                return pairs.findIndex(pair => pair.performance_id === span.id) == -1
            })
        : []

    useEffect(() => {
        if (!midi || !mei) return

        // collect matched spans with their onset times
        const spans = asSpans(midi, true)
        const matched = pairs
            .map(p => {
                const span = spans.find(s => s.id === p.performance_id)
                return span ? { onset: span.onset, scoreId: p.score_id } : null
            })
            .filter((x): x is { onset: number; scoreId: string } => x !== null)

        if (matched.length === 0) return

        // find the last by onset
        matched.sort((a, b) => a.onset - b.onset)
        const last = matched[matched.length - 1]

        // scroll editor to the occurrence of the scoreId
        const idx = mei.indexOf(last.scoreId)
        if (idx !== -1) {
            scrollToRange(idx, idx + last.scoreId.length)
        }
    }, [mei, midi, pairs])

    return (
        <>
            <Stack spacing={1}>
                <Box>
                    <Stack spacing={1} direction='row'>
                        <Button variant="outlined" component="label">
                            Upload MEI
                            <input type="file" hidden accept=".mei" onChange={handleMEI} />
                        </Button>

                        <Button variant="outlined" component="label">
                            {midiFileName || 'Upload MIDI'}
                            <input type="file" hidden accept=".midi,.mid" onChange={handleMIDI} />
                        </Button>

                        {(mei && midi) && (
                            <>
                                <Tooltip title='Keep the alignment shown: insert <when> elements and <manifestation>s.'>
                                    <Button variant="contained" onClick={() => alignedMEI && setMEI(alignedMEI)}>
                                        Finalize
                                    </Button>
                                </Tooltip>
                                <Button variant='contained' size='small' onClick={handleDownload} startIcon={<Download />}>
                                    Download
                                </Button>
                            </>
                        )}

                        <IconButton
                            onClick={() => {
                                if (!midi) return
                                if (playing) {
                                    stop()
                                    setPlaying(false)
                                }
                                else {
                                    play(midi)
                                    setPlaying(true)
                                }
                            }}
                        >
                            {playing ? <StopCircle /> : <PlayCircle />}
                        </IconButton>

                        <IconButton onClick={() => setShowHelp(true)}>
                            <Info />
                        </IconButton>

                        {pairs.length > 0 && (
                            <>
                                <Typography sx={{ alignSelf: 'center' }}>
                                    Zoom:
                                </Typography>
                                <FormControl sx={{ alignSelf: 'center' }}>
                                    <Slider
                                        sx={{ width: '5rem' }}
                                        min={4}
                                        max={64}
                                        step={2}
                                        value={scale}
                                        onChange={(_, value) => setScale(value as number)}
                                        valueLabelDisplay="auto"
                                    />
                                </FormControl>
                            </>
                        )}
                    </Stack>
                </Box>

                <Box>
                    {pairs.length > 0 && (
                        <span style={{ color: 'gray' }}>
                            ({pairs.length} matches,{' '}
                            {unmatchedSpans.length} unmatched elements{' '})
                        </span>
                    )}
                </Box>

                <Stack spacing={1} direction='row'>
                    <Box>
                        <div style={{ width: '100vw', overflow: 'scroll', position: 'relative' }}>
                            {alignedMEI && (
                                <PerformedScore
                                    mei={alignedMEI}
                                    options={{ performanceScale: scale }}
                                    onNoteClick={note => {
                                        if (!mei || !mei.includes(note.id)) return
                                        scrollToRange(mei.indexOf(note.id), mei.indexOf(note.id) + note.id.length)
                                    }}
                                    onNoteHover={note => note.pitch && playSingleNote(note.pitch)}
                                />)}

                            <MidiViewer
                                spans={unmatchedSpans}
                                toSVG={(([x, y]) => toSVG([x, y]))}
                                height={700}
                                onClick={(span) => {
                                    setSelectedSpans(prev => {
                                        if (prev.find(s => s.id === span.id)) {
                                            return prev.filter(s => s.id !== span.id);
                                        }
                                        else {
                                            return [...prev, span];
                                        }
                                    })
                                }}
                                highlight={selectedSpans}
                            />
                        </div>
                    </Box>

                    {mei && (
                        <Accordion
                            defaultExpanded
                            sx={{
                                position: 'absolute',
                                right: '1rem',
                                top: '2rem',
                                backgroundColor: 'rgba(255, 255, 255)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 10px 20px 0 rgba(0, 0, 0, 0.3)',
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMore />}
                                sx={{
                                    minHeight: 'auto',
                                }}>
                                MEI Editor
                            </AccordionSummary>
                            <AccordionDetails>
                                <CodeEditor
                                    mei={mei || ''}
                                    onSave={setMEI}
                                    ref={editorRef}
                                    selectedSpans={selectedSpans}
                                />
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Stack>
            </Stack>

            <Box sx={{ position: 'fixed', bottom: 0, width: '90vw', textAlign: 'left', backgroundColor: 'white', padding: '0.5rem' }}>
                <span>&copy; {new Date().getFullYear()} Niels Pfeffer</span>
            </Box>

            <InfoDialog
                open={showHelp}
                onClose={() => setShowHelp(false)}
            />
        </>
    )
}
