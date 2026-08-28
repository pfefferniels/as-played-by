import { useEffect, useMemo, useState } from "react";
import {
    AppBar,
    Alert,
    Box,
    LinearProgress,
    MenuItem,
    Select,
    Slider,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Typography,
} from "@mui/material";
import { HorizontalRule, ViewDay } from "@mui/icons-material";
import "./App.css";
import { PerformedScore } from "../verovio/PerformedScore";
import { DEFAULT_PERFORMANCE_SCALE } from "../verovio/toolkit";
import { parseRecordings, type RecordingInfo } from "../mei/parseRecordings";
import type { PlayableNote } from "../performance/buildMidiFile";
import { clock, usePlayback } from "./usePlayback";
import { PlaybackBar } from "./PlaybackBar";

/** The performed seconds one system covers, when the score is broken into systems */
const SYSTEM_DURATION = 10;

function describe(recording: RecordingInfo): string {
    const offsets = [...recording.noteSpans.values()].map((span) => span.offsetMs);
    if (offsets.length === 0) return "no notes";

    return `${offsets.length} notes · ${clock(Math.max(...offsets))}`;
}

export default function Viewer() {
    const [mei, setMEI] = useState<string>();
    const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
    const [pitchMap, setPitchMap] = useState<Map<string, number>>(new Map());
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [scale, setScale] = useState(DEFAULT_PERFORMANCE_SCALE);
    const [singleLine, setSingleLine] = useState(false);
    const [extenders, setExtenders] = useState(false);
    const [error, setError] = useState<string>();

    const selectedRecording = recordings[selectedIdx];

    /**
     * The notes of the recording, with the score note each one sounded as its
     * id: the <when> says when a note was played, and the score says which note
     * and at what pitch.
     */
    const notes = useMemo<PlayableNote[]>(() => {
        if (!selectedRecording) return [];

        return [...selectedRecording.noteSpans].flatMap(([noteId, span]) => {
            const pitch = pitchMap.get(noteId);
            return pitch === undefined
                ? []
                : [
                      {
                          id: noteId,
                          pitch,
                          onsetMs: span.onsetMs,
                          offsetMs: span.offsetMs,
                          velocity: span.velocity,
                      },
                  ];
        });
    }, [selectedRecording, pitchMap]);

    const playback = usePlayback({ notes, pedals: selectedRecording?.pedalEvents });

    // The recording is selected by its 1-based position, the way verovio counts them
    const options = useMemo(
        () => ({
            performanceRecording: String(selectedIdx + 1),
            performanceScale: scale,
            performanceSystemDuration: singleLine ? 0 : SYSTEM_DURATION,
        }),
        [selectedIdx, scale, singleLine]
    );

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}transcription.mei`)
            .then((response) => {
                if (!response.ok) throw new Error("Failed to load transcription.mei");
                return response.text();
            })
            .then((meiText) => {
                const { recordings, pitchMap } = parseRecordings(meiText);
                setMEI(meiText);
                setRecordings(recordings);
                setPitchMap(pitchMap);
                setSelectedIdx(0);
            })
            .catch((reason: unknown) => setError(String(reason)));
    }, []);

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!mei) {
        return (
            <Box sx={{ p: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading score&hellip;
                </Typography>
            </Box>
        );
    }

    return (
        <Box className="viewer-mode" sx={{ minHeight: "100vh", bgcolor: "background.paper" }}>
            <AppBar
                position="sticky"
                color="inherit"
                elevation={0}
                sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}
            >
                <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: 1 }}>
                    <PlaybackBar playback={playback} />

                    {recordings.length > 1 && (
                        <Select
                            size="small"
                            value={selectedIdx}
                            onChange={(e) => {
                                playback.stop();
                                setSelectedIdx(Number(e.target.value));
                            }}
                        >
                            {recordings.map((recording, index) => (
                                <MenuItem key={recording.source} value={index}>
                                    {recording.label}
                                </MenuItem>
                            ))}
                        </Select>
                    )}

                    {selectedRecording && (
                        <Typography variant="body2" color="text.secondary">
                            {describe(selectedRecording)}
                        </Typography>
                    )}

                    <Box sx={{ flex: 1 }} />

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                            Scale
                        </Typography>
                        <Slider
                            size="small"
                            min={4}
                            max={64}
                            step={2}
                            value={scale}
                            onChange={(_, value) => setScale(value as number)}
                            valueLabelDisplay="auto"
                            sx={{ width: "8rem" }}
                        />
                    </Stack>

                    <ToggleButtonGroup size="small">
                        <ToggleButton
                            value="singleLine"
                            selected={singleLine}
                            onChange={() => setSingleLine((on) => !on)}
                            title="Lay the whole performance out on a single line"
                        >
                            <ViewDay fontSize="small" sx={{ mr: 0.5 }} />
                            One line
                        </ToggleButton>
                        <ToggleButton
                            value="extenders"
                            selected={extenders}
                            onChange={() => setExtenders((on) => !on)}
                            title="Draw a line from each note to where it was released"
                        >
                            <HorizontalRule fontSize="small" sx={{ mr: 0.5 }} />
                            Held notes
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Toolbar>
            </AppBar>

            <Box sx={{ overflowX: "auto", px: 2, py: 2 }}>
                <PerformedScore mei={mei} options={options} extenders={extenders} />
            </Box>

            <Box
                component="footer"
                sx={{ px: 2, py: 2, borderTop: 1, borderColor: "divider" }}
            >
                <Typography variant="body2" color="text.secondary">
                    &copy; {new Date().getFullYear()} Niels Pfeffer
                </Typography>
            </Box>
        </Box>
    );
}
