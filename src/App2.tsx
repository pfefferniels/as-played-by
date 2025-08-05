import { MidiFile, read } from "midifile-ts";
import { useRef, useState } from "react";
import { asSpans } from "./MidiSpans";
import { MidiViewer } from "./MidiViewer";
import { Box, Button, FormControl, IconButton, Slider, Stack } from "@mui/material"
import { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { AlignedMEI } from "./AlignedMEI";
import "./App.css"
import { CodeEditor } from "./CodeEditor";
import { insertRecording, insertWhen } from "./When";
import { Info } from "@mui/icons-material";
import InfoDialog from "./Info";
import { insertPedals } from "./insertPedals";
import { insertMetadata, parseMetadata } from "./insertMetadata";
import { getPairs, Pair } from "./loadParangonar";

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
            const pairs = await getPairs(midi, mei)
            if (!pairs) return

            setPairs(pairs)

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

            setMEI(new XMLSerializer().serializeToString(meiDoc))
        }

        perform()
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

    const toSVG = ([a, b]: [number, number]) => [(a - 100) * stretch, (110 - b) * 5] as [number, number]

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
                            <Button variant="contained" onClick={handleAlign}>
                                Align
                            </Button>
                        )}

                        <IconButton onClick={() => setShowHelp(true)}>
                            <Info />
                        </IconButton>
                    </Stack>
                </Box>

                <Box>
                    {pairs.length > 0 && (
                        <span style={{ color: 'gray' }}>
                            ({pairs.filter(p => p.label === 'match').length} matches,{' '}
                            {pairs.filter(p => p.label === 'deletion').length} deletions,{' '}
                            {pairs.filter(p => p.label === 'insertion').length} insertions)</span>
                    )}
                </Box>

                <Box sx={{ display: pairs.length === 0 ? 'none' : 'block' }}>
                    <FormControl>
                        <Slider
                            sx={{ width: '20rem' }}
                            min={0.01}
                            max={0.2}
                            step={0.01}
                            value={stretch}
                            onChange={(_, value) => setStretch(value as number)}
                            valueLabelDisplay="auto"
                        />
                    </FormControl>
                </Box>

                <Stack spacing={1} direction='row'>
                    <Box>
                        <div style={{ width: '50vw', overflow: 'scroll' }}>
                            {midi && (
                                <MidiViewer
                                    file={midi}
                                    height={390}
                                    toSVG={toSVG}
                                    isInsertion={(id: string) => {
                                        if (!pairs.length) return false
                                        return pairs.findIndex(pair => {
                                            pair.label === 'insertion' && pair.performance_id === id
                                        }) !== -1
                                    }}
                                />)}

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
                                        if (!mei) return

                                        const id = svgNote.getAttribute('data-id') || 'no-id'
                                        if (mei.includes(id)) {
                                            scrollToRange(mei.indexOf(id), mei.indexOf(id) + id.length)
                                        }
                                    }}
                                    toSVG={([x, y]) => toSVG([(x - 500) * 10, y])}
                                />)}
                        </div>
                    </Box>

                    <Box>
                        <CodeEditor
                            mei={mei || ''}
                            onSave={setMEI}
                            ref={editorRef}
                        />
                    </Box>
                </Stack>
            </Stack>

            <Box sx={{ position: 'fixed', bottom: 0, width: '100vw', textAlign: 'left', backgroundColor: 'white', padding: '0.5rem', boxShadow: '0 -2px 5px rgba(0,0,0,0.1)' }}>
                <span>&copy; {new Date().getFullYear()} Niels Pfeffer</span>
            </Box>

            <InfoDialog
                open={showHelp}
                onClose={() => setShowHelp(false)}
            />
        </>
    )
}