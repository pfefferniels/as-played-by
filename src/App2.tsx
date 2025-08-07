import { MidiFile, read } from "midifile-ts";
import { useEffect, useRef, useState } from "react";
import { asSpans } from "./MidiSpans";
import { MidiViewer } from "./MidiViewer";
import { Box, Button, FormControl, FormLabel, IconButton, Slider, Stack, Typography } from "@mui/material"
import { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { AlignedMEI } from "./AlignedMEI";
import "./App.css"
import { CodeEditor } from "./CodeEditor";
//import { insertRecording, insertWhen } from "./When";
import { Download, Info } from "@mui/icons-material";
import InfoDialog from "./Info";
//import { insertPedals } from "./insertPedals";
//import { insertMetadata, parseMetadata } from "./insertMetadata";
import { Pair } from "./loadParangonar";
import { getNotesFromMEI, naiveAligner } from "./NaiveAligner";
import { insertMetadata, parseMetadata } from "./insertMetadata";
import { insertRecording, insertWhen } from "./When";
import { insertPedals } from "./insertPedals";

/*const isPair = (pair: Partial<Pair>): pair is Pair => {
    if (!('label' in pair)) return false
    if (pair.label === 'match') return 'performance_id' in pair && 'score_id' in pair
    else if (pair.label === 'deletion') return 'score_id' in pair
    else if (pair.label === 'insertion') return 'performance_id' in pair
    return false
}*/

export const App = () => {
    const [mei, setMEI] = useState<string>()
    const [midi, setMIDI] = useState<MidiFile>()
    const [midiFileName, setMidiFileName] = useState<string>('')
    const [pairs, setPairs] = useState<Pair[]>([])
    const [stretch, setStretch] = useState<number>(0.1);
    const [showHelp, setShowHelp] = useState(false)

    const editorRef = useRef<ReactCodeMirrorRef>(null)

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

    const handleAlign = () => {
        if (!mei || !midi) return

        const perform = async () => {
            setPairs(naiveAligner(await getNotesFromMEI(mei), asSpans(midi, true)))
        }
        perform()

        /*
        
                    setMEI(new XMLSerializer().serializeToString(meiDoc))
                    */
    }

    const handleDownload = () => {
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
            if (pair.label !== 'match') continue

            const span = spans.find(span => span.id === pair.performance_id)
            if (!span) continue

            insertWhen(meiDoc, recording, span, pair.score_id)
        }

        insertPedals(
            spans.filter(span => span.type === 'soft' || span.type === 'sustain'),
            [],
            meiDoc
        )

        const text = new XMLSerializer().serializeToString(meiDoc);

        const blob = new Blob([text], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'as-played-by.mei';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const scrollToRange = (left: number, right: number) => {
        if (!editorRef.current || !editorRef.current.state?.doc) {
            return
        }

        editorRef.current.view?.dispatch({
            selection: EditorSelection.single(left, right),
            scrollIntoView: true,
        })
    }

    const toSVG = ([a, b]: [number, number]) => [a * stretch, (100 - b) * 10] as [number, number]

    const insertedSpans = (midi && pairs.length > 0) ? asSpans(midi, true).filter(span => {
        return pairs.some(pair => pair.label === 'insertion' && pair.performance_id === span.id)
    }) : []

    useEffect(() => {
        if (!midi || !mei) return

        // collect matched spans with their onset times
        const spans = asSpans(midi, true)
        const matched = pairs
            .filter(p => p.label === 'match' && 'performance_id' in p && 'score_id' in p)
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
                                <Button variant="contained" onClick={handleAlign}>
                                    Align
                                </Button>
                                <Button variant='contained' size='small' onClick={handleDownload} startIcon={<Download />}>
                                    Download
                                </Button>
                            </>
                        )}

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
                                        sx={{ width: '10rem' }}
                                        min={0.01}
                                        max={0.2}
                                        step={0.01}
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
                            ({pairs.filter(p => p.label === 'match').length} matches,{' '}
                            {pairs.filter(p => p.label === 'deletion').length} deletions,{' '}
                            {pairs.filter(p => p.label === 'insertion').length} insertions)
                        </span>
                    )}
                </Box>

                <Stack spacing={1} direction='row'>
                    <Box>
                        <div style={{ width: '100vw', overflow: 'scroll', position: 'relative' }}>
                            {mei && (
                                <AlignedMEI
                                    mei={mei}
                                    getSpanForNote={(id: string) => {
                                        if (!midi || pairs.length === 0) return

                                        const pair = pairs.find(pair => ('score_id' in pair) && pair.score_id === id)
                                        if (!pair) return

                                        if (pair.label === 'deletion') {
                                            return 'deletion'
                                        }

                                        const spans = asSpans(midi)
                                        return spans.find(span => span.id === pair.performance_id)
                                    }}
                                    onClick={svgNote => {
                                        console.log('onClick')
                                        if (!mei) return

                                        const id = svgNote.getAttribute('data-id') || 'no-id'
                                        console.log('id', id)
                                        if (mei.includes(id)) {
                                            scrollToRange(mei.indexOf(id), mei.indexOf(id) + id.length)
                                        }
                                    }}
                                    toSVG={([x, y]) => toSVG([x * 14, y])}
                                />)}

                            <MidiViewer
                                spans={insertedSpans}
                                toSVG={toSVG}
                                height={700}
                                onClick={(span) => {
                                    const view = editorRef.current?.view
                                    if (!view || span.type !== 'note') return

                                    // get the insertion point (cursor head)
                                    const { head } = view.state.selection.main

                                    if (!span) return;
                                    const pitch = span.pitch;
                                    const chroma = ((pitch % 12) + 12) % 12;
                                    const [pname, ...accArr] = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"][chroma];
                                    const accid = accArr.join("");
                                    const oct = Math.floor(pitch / 12) - 1;

                                    const meiNote = `<note pname="${pname}" oct="${oct}" xml:id="${span.id}" dur="4" stem.dir="up" accid="${accid}" />\n`;

                                    view.dispatch({
                                        changes: { from: head, insert: meiNote },
                                        selection: EditorSelection.single(head + meiNote.length)
                                    })

                                    view.focus()
                                }}
                            />
                        </div>
                    </Box>

                    <Box
                        style={{
                            position: 'absolute',
                            right: '1rem',
                            backgroundColor: 'rgba(255, 255, 255)',
                            padding: '15px 30px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: '0 10px 20px 0 rgba(0, 0, 0, 0.3)',
                        }}
                    >
                        <CodeEditor
                            mei={mei || ''}
                            onSave={setMEI}
                            ref={editorRef}
                        />
                    </Box>
                </Stack>
            </Stack>

            <Box sx={{ position: 'fixed', bottom: 0, width: '90vw', textAlign: 'left', backgroundColor: 'white', padding: '0.5rem', boxShadow: '0 -2px 5px rgba(0,0,0,0.1)' }}>
                <span>&copy; {new Date().getFullYear()} Niels Pfeffer</span>
            </Box>

            <InfoDialog
                open={showHelp}
                onClose={() => setShowHelp(false)}
            />
        </>
    )
}