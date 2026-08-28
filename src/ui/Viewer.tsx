import { useCallback, useEffect, useMemo, useState } from "react";
import { usePiano } from "react-pianosound";
import type { AnyEvent } from "midifile-ts";
import {
    AppBar,
    Alert,
    Box,
    Button,
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
import { HorizontalRule, PlayArrow, Stop, ViewDay } from "@mui/icons-material";
import "./App.css";
import { PerformedScore } from "../verovio/PerformedScore";
import { DEFAULT_PERFORMANCE_SCALE } from "../verovio/toolkit";
import { parseRecordings, type RecordingInfo } from "../mei/parseRecordings";
import { buildMidiFile } from "../performance/buildMidiFile";
import { useSampleProgress } from "./pianoLoading";

/** The performed seconds one system covers, when the score is broken into systems */
const SYSTEM_DURATION = 10;

function highlightNote(noteId: string) {
    const el = document.querySelector(`[data-id="${noteId}"]`);
    if (!el) return;

    el.classList.add("note-playing");
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    setTimeout(() => el.classList.remove("note-playing"), 600);
}

function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function describe(recording: RecordingInfo): string {
    const offsets = [...recording.noteSpans.values()].map((span) => span.offsetMs);
    if (offsets.length === 0) return "no notes";

    return `${offsets.length} notes · ${formatDuration(Math.max(...offsets))}`;
}

export default function Viewer() {
    const [mei, setMEI] = useState<string>();
    const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
    const [pitchMap, setPitchMap] = useState<Map<string, number>>(new Map());
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [scale, setScale] = useState(DEFAULT_PERFORMANCE_SCALE);
    const [singleLine, setSingleLine] = useState(false);
    const [extenders, setExtenders] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string>();

    const { play, stop, status } = usePiano();
    const loading = status === "loading";
    const samples = useSampleProgress(loading);

    const selectedRecording = recordings[selectedIdx];

    const midiFile = useMemo(() => {
        if (!selectedRecording || pitchMap.size === 0) return null;
        return buildMidiFile(selectedRecording, pitchMap);
    }, [selectedRecording, pitchMap]);

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

    const handleStop = useCallback(() => {
        stop();
        setIsPlaying(false);
        document
            .querySelectorAll(".note-playing")
            .forEach((el) => el.classList.remove("note-playing"));
    }, [stop]);

    const handlePlay = useCallback(() => {
        if (!midiFile) return;
        setIsPlaying(true);
        play(midiFile, (event: AnyEvent) => {
            if (event.type === "meta" && event.subtype === "text" && "text" in event) {
                highlightNote((event as AnyEvent & { text: string }).text);
            }
        });
    }, [midiFile, play]);

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
                    <Button
                        variant="contained"
                        disableElevation
                        startIcon={isPlaying ? <Stop /> : <PlayArrow />}
                        onClick={isPlaying ? handleStop : handlePlay}
                        disabled={!midiFile || status !== "done"}
                        sx={{ minWidth: "7rem" }}
                    >
                        {isPlaying ? "Stop" : "Play"}
                    </Button>

                    {recordings.length > 1 && (
                        <Select
                            size="small"
                            value={selectedIdx}
                            onChange={(e) => {
                                handleStop();
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

                    {loading && (
                        <Stack sx={{ minWidth: "12rem" }}>
                            <Typography variant="caption" color="text.secondary">
                                Loading piano samples
                                {samples.samples > 0 && ` · ${samples.samples} loaded`}
                                {samples.bytes > 0 &&
                                    ` · ${(samples.bytes / 1_000_000).toFixed(1)} MB`}
                            </Typography>
                            <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />
                        </Stack>
                    )}

                    {status === "error" && (
                        <Typography variant="body2" color="error">
                            The piano samples could not be loaded
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
