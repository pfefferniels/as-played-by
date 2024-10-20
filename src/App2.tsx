import { MidiFile, read } from "midifile-ts";
import { useState } from "react";
import { asSpans, midiSpansForParangonar } from "./MidiSpans";
import { MidiViewer } from "./MidiViewer";
import { Box, Button, FormControl, Slider, Stack } from "@mui/material"
import CodeMirror from "@uiw/react-codemirror";
import { AlignedMEI } from "./AlignedMEI";
import "./App.css"

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
    const [mei, setMEI] = useState<string>();
    const [midi, setMIDI] = useState<MidiFile>();
    const [pairs, setPairs] = useState<Pair[]>([])

    const [stretch, setStretch] = useState<number>(0.1);

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

    const alignWithParangonar = () => {
        if (!midi || !mei) return

        const spans = midiSpansForParangonar(midi)

        const formData = new FormData()
        formData.append('mei', mei)
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
                        pair.score_id = pair.score_id.slice(4)
                    }
                    
                    return pair
                }))
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
                    <Button variant="outlined" onClick={downloadMEI}>Download Aligned MEI</Button>
                    <Button variant="outlined" onClick={alignWithParangonar}>Align</Button>
                </Stack>
                <span style={{ color: 'gray' }}>({pairs.length} pairs)</span>
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
                        {mei && (
                            <AlignedMEI
                                mei={mei}
                                getSpanForNote={(id: string) => {
                                    if (!midi || pairs.length === 0) return

                                    const pair = pairs.find(pair => pair.score_id === id)
                                    if (!pair) return

                                    if (pair.label === 'deletion') {
                                        return 'deletion'
                                    }

                                    const spans = asSpans(midi)
                                    return spans.find(span => span.id === pair.performance_id)
                                }}
                                toSVG={toSVG}
                            />
                        )
                        }
                    </div>
                </Box>

                <Box>
                    <CodeMirror
                        value={mei || ''}
                        height="80vh"
                        width="48vw"
                    />
                </Box>
            </Stack>
        </>
    )
}