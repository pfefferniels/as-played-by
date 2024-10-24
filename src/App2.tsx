import { MidiFile, read } from "midifile-ts";
import { useRef, useState } from "react";
import { asSpans, midiSpansForParangonar } from "./MidiSpans";
import { MidiViewer } from "./MidiViewer";
import { Box, Button, FormControl, Slider, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material"
import { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { AlignedMEI } from "./AlignedMEI";
import "./App.css"
import { CodeEditor } from "./CodeEditor";
import { OriginalMEI } from "./OriginalMEI";
import { insertWhen } from "./When";

interface Pair {
    label: 'match' | 'deletion' | 'insertion'
    performance_id: string
    score_id: string
}

const isPair = (pair: Partial<Pair>): pair is Pair => {
    if (!('label' in pair)) return false
    if (pair.label === 'match') return 'performance_id' in pair && 'score_id' in pair
    else if (pair.label === 'deletion') return 'score_id' in pair
    else if (pair.label === 'insertion') return 'performance_id' in pair
    return false
}

export const App = () => {
    const [mei, setMEI] = useState<string>()
    const [midi, setMIDI] = useState<MidiFile>()
    const [pairs, setPairs] = useState<Pair[]>([])

    const [stretch, setStretch] = useState<number>(0.1);
    const [mode, setMode] = useState<'original' | 'aligned'>('original');

    const editorRef = useRef<ReactCodeMirrorRef>(null)

    const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files.length) return;

        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target || !e.target.result) return;

            setMEI(e.target.result as string)
        };

        reader.readAsText(file);
    };

    const handleMIDI = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files.length) return;

        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target) return;
            const binaryData = e.target.result;
            const newMIDI = read(binaryData as ArrayBuffer)
            setMIDI(newMIDI);
        };

        reader.readAsArrayBuffer(file);
    };

    const downloadMEI = () => {
        if (!mei) return;

        const blob = new Blob([mei], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aligned.mei';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const alignWithParangonar = async () => {
        if (!midi || !mei) return

        const spans = midiSpansForParangonar(midi)

        const formData = new FormData()

        // make sure to only select performed notes
        const meiDoc = new DOMParser().parseFromString(mei, 'application/xml')
        meiDoc.querySelectorAll('app').forEach((app) => {
            const perfRdg = app.querySelector('rdg[source="performance"]')
            if (!perfRdg) {
                // partitura, on which parangonar is based, 
                // does not digest <app> elements: make sure
                // there are none left
                app.remove()
                return
            }

            app.replaceWith(...perfRdg.childNodes)
        })

        formData.append('mei', new XMLSerializer().serializeToString(meiDoc))
        formData.append('midi', JSON.stringify(spans))

        fetch('http://localhost:5000/align', {
            method: 'POST',
            body: formData
        }).then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data) || !data.every(entry => isPair(entry))) {
                    console.log('Malformed data provoded')
                    return
                }

                setPairs(data.map(pair => {
                    if ('score_id' in pair) {
                        // FIXME: different for multiple staves: use slice(4)
                        pair.score_id = pair.score_id.slice(0)
                    }

                    return pair
                }))
            })
    }

    const handleInsert = () => {
        if (!midi || !mei) return 

        const meiDoc = new DOMParser().parseFromString(mei, 'text/xml')
        const spans = asSpans(midi)
        for (const pair of pairs) {
            if (pair.label !== 'match') continue 

            const span = spans.find(span => span.id === pair.performance_id)
            if (!span) continue 

            insertWhen(meiDoc, span, pair.score_id)
        }

        setMEI(new XMLSerializer().serializeToString(meiDoc))
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
            <Box>
                <Stack spacing={1} direction='row'>
                    <Button variant="outlined" component="label">
                        Upload MEI
                        <input type="file" hidden accept=".mei" onChange={handleMEI} />
                    </Button>
                    <br />

                    <Button variant="outlined" component="label">
                        Upload MIDI
                        <input type="file" hidden accept=".midi,.mid" onChange={handleMIDI} />
                    </Button>
                </Stack>
            </Box>

            <Box>
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

            <Box>
                <Stack spacing={1} direction='row'>
                    <Button variant="outlined" onClick={alignWithParangonar}>Align</Button>
                    <Button
                        variant="outlined"
                        disabled={pairs.length === 0}
                        onClick={handleInsert}
                    >
                        Insert {'<'}when{'>'}s
                    </Button>
                    <ToggleButtonGroup
                        value={mode}
                        exclusive
                        onChange={(_, value) => setMode(value as 'original' | 'aligned')}
                        aria-label="alignment"
                    >
                        <ToggleButton value="original" aria-label="original">
                            Original
                        </ToggleButton>
                        <ToggleButton value="aligned" aria-label="aligned" disabled={pairs.length === 0}>
                            Aligned
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
                {pairs.length > 0 && (
                    <span style={{ color: 'gray' }}>
                        ({pairs.filter(p => p.label === 'match').length} matches,{' '}
                        {pairs.filter(p => p.label === 'deletion').length} deletions,{' '}
                        {pairs.filter(p => p.label === 'insertion').length} insertions)</span>
                )}
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
                                    const pair = pairs.find(pair => pair.performance_id === id)
                                    return pair?.label === 'insertion' || false
                                }}
                            />)}
                    </div>

                    <div style={{ width: '50vw', overflow: 'scroll' }}>
                        {(mei && mode === 'aligned')
                            ? (
                                <AlignedMEI
                                    mei={mei}
                                    getSpanForNote={(id: string) => {
                                        if (!midi || pairs.length === 0) return

                                        console.log(pairs)

                                        const pair = pairs.find(pair => pair.score_id === id)
                                        console.log('pair', pair)
                                        if (!pair) return

                                        if (pair.label === 'deletion') {
                                            return 'deletion'
                                        }

                                        const spans = asSpans(midi)
                                        return spans.find(span => span.id === pair.performance_id)
                                    }}
                                    onClick={(id: string) => {
                                        console.log(id, 'clicked')
                                        if (!mei) return

                                        if (mei.includes(id)) {
                                            scrollToRange(mei.indexOf(id), mei.indexOf(id) + id.length)
                                        }
                                    }}
                                    toSVG={toSVG}
                                />)
                            : (
                                <OriginalMEI
                                    mei={mei || ''}
                                    onClick={(id: string) => {
                                        if (!mei) return

                                        if (mei.includes(id)) {
                                            scrollToRange(mei.indexOf(id), mei.indexOf(id) + id.length)
                                        }
                                    }}
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
        </>
    )
}