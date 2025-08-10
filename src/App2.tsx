import { MidiFile, read } from "midifile-ts";
import { useEffect, useRef, useState } from "react";
import { AnySpan, asSpans } from "./MidiSpans";
import { MidiViewer } from "./MidiViewer";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControl, IconButton, Slider, Stack, Typography } from "@mui/material"
import { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { AlignedMEI } from "./AlignedMEI";
import "./App.css"
import { CodeEditor } from "./CodeEditor";
import { Download, ExpandMore, Info, PlayCircle, StopCircle } from "@mui/icons-material";
import InfoDialog from "./Info";
import { getNotesFromMEI, Match, naiveAligner } from "./NaiveAligner";
import { insertMetadata, parseMetadata } from "./insertMetadata";
import { insertRecording, insertWhen } from "./When";
import { insertPedals } from "./insertPedals";
import { usePiano } from "react-pianosound";

export const App = () => {
    const [mei, setMEI] = useState<string>()
    const [midi, setMIDI] = useState<MidiFile>()
    const [midiFileName, setMidiFileName] = useState<string>('')
    const [pairs, setPairs] = useState<Match[]>([])
    const [stretch, setStretch] = useState<number>(0.05);
    const [showHelp, setShowHelp] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [duplicateNoteIDs, setDuplicateNoteIDs] = useState<string[]>([])
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

    const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files.length) return;

        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target || !e.target.result) return;

            setMEI(e.target.result as string);
        };

        reader.readAsText(file);
    };

    const handleMIDI = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files.length) return;

        const file = event.target.files[0];
        if (!file) return;

        setMidiFileName(file.name)
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target) return;
            const binaryData = e.target.result;
            const newMIDI = read(binaryData as ArrayBuffer)
            setMIDI(newMIDI);
        };

        reader.readAsArrayBuffer(file);
    };

    useEffect(() => {
        if (!mei || !midi) return

        const perform = async () => {
            const notes = await getNotesFromMEI(mei);
            setPairs(naiveAligner(notes.notes, asSpans(midi, true)))
            setDuplicateNoteIDs(notes.duplicateNoteIDs)
            setSelectedSpans([])
        }
        perform()
    }, [mei, midi])

    const handleFinalize = () => {
        if (!mei || !midi) return

        const meiDoc = new DOMParser().parseFromString(mei, 'application/xml')
        const metadata = parseMetadata(midi)
        insertMetadata(metadata, meiDoc)

        const spans = asSpans(midi, true)
        const recording = insertRecording(meiDoc, metadata?.source)
        if (!recording) {
            console.log('Failed creating recording')
            return
        }

        for (const pair of pairs) {
            const span = spans.find(span => span.id === pair.performance_id)
            if (!span) continue

            insertWhen(meiDoc, recording, span, pair.score_id)
        }

        insertPedals(
            spans.filter(span => span.type === 'soft' || span.type === 'sustain'),
            [],
            meiDoc
        )

        setMEI(new XMLSerializer().serializeToString(meiDoc))
    };

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

    const toSVG = ([a, b]: [number, number]) => [a * stretch, (100 - b) * 8] as [number, number]

    const unmatchedSpans = (midi && pairs.length > 0)
        ? asSpans(midi, true)
            .filter(span => span.type === 'note')
            .sort((a, b) => a.onsetMs - b.onsetMs)
            .filter(span => {
                return pairs.findIndex(pair => pair.performance_id === span.id) == -1
            })
        : []

    console.log('unmatched spans', unmatchedSpans)

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
                                <Button variant="contained" onClick={handleFinalize}>
                                    Finalize
                                </Button>
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
                                        min={0.01}
                                        max={0.2}
                                        step={0.005}
                                        value={stretch}
                                        onChange={(_, value) => setStretch(value as number)}
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
                            {mei && (
                                <AlignedMEI
                                    mei={mei}
                                    duplicateNoteIDs={duplicateNoteIDs}
                                    getSpanForNote={(id: string) => {
                                        if (!midi || pairs.length === 0) return

                                        const pair = pairs.find(pair => ('score_id' in pair) && pair.score_id === id)
                                        if (!pair) return

                                        const spans = asSpans(midi)
                                        return spans.find(span => span.id === pair.performance_id)
                                    }}
                                    onClick={svgNote => {
                                        if (!mei) return

                                        const id = svgNote.getAttribute('data-id') || 'no-id'
                                        console.log('id', id)
                                        if (mei.includes(id)) {
                                            scrollToRange(mei.indexOf(id), mei.indexOf(id) + id.length)
                                        }
                                    }}
                                    onHover={(svgNote) => {
                                        console.log(svgNote)
                                        const pname = svgNote.getAttribute('data-pname')
                                        const oct = +(svgNote.getAttribute('data-oct') || '')
                                        const accid = svgNote.getAttribute('data-accid') || svgNote.getAttribute('data-accid.ges')
                                        console.log(pname, oct, accid)
                                        if (!pname || !oct) return

                                        const base: Record<string, number> = {
                                            c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11
                                        };
                                        const accMap: Record<string, number> = {
                                            "": 0, s: 1, ss: 2, f: -1, ff: -2
                                        };

                                        const semitone = (base[pname] || 0) + (accMap[accid || ''] || 0);
                                        const midiPitch = (oct + 1) * 12 + semitone;
                                        console.log('Playing note:', midiPitch);

                                        playSingleNote(midiPitch);
                                    }}
                                    stretchX={stretch * 14.1}
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