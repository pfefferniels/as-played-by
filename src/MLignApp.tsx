import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { read, type MidiFile } from "midifile-ts";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    GlobalStyles,
    LinearProgress,
    Paper,
    Slider,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import { asSpans, type NoteSpan } from "./MidiSpans";
import { getNotesFromMEI } from "./NaiveAligner";
import { applyAlignment } from "./applyAlignment";
import { PerformedScore } from "./verovio/PerformedScore";
import {
    MismatchedPairError,
    alignScoreToPerformance,
    checkPerformance,
    checkScore,
    hasRepeatSigns,
    hasUntimedGraceNotes,
    toMatches,
    unshowableScoreIds,
    type AlignProgress,
    type AlignResult,
} from "./mlign";

/** MEI units given to one second of performed time */
const DEFAULT_SCALE = 16;

/** Matched noteheads, and the notes the recording never reached */
const MATCHED_COLOUR = "#1d4ed8";
const UNPLAYED_COLOUR = "#c9ced6";

const scoreStyles = {
    ".mlign-score .mlign-matched, .mlign-score .mlign-matched *": {
        fill: `${MATCHED_COLOUR} !important`,
        stroke: `${MATCHED_COLOUR} !important`,
    },
    ".mlign-score .mlign-unplayed, .mlign-score .mlign-unplayed *": {
        fill: `${UNPLAYED_COLOUR} !important`,
        stroke: `${UNPLAYED_COLOUR} !important`,
    },
    ".mlign-score [data-perf-unaligned], .mlign-score [data-perf-unaligned] *": {
        fill: `${UNPLAYED_COLOUR} !important`,
        stroke: `${UNPLAYED_COLOUR} !important`,
    },
};

/**
 * How far along the whole job each stage is, so that the bar moves even though
 * only the model stage can say anything about its own progress.
 */
const STAGE_PERCENT = {
    score: 8,
    featurizing: 18,
    loading: 30,
    running: 45,
    decoding: 88,
    rendering: 94,
} as const;

type Stage = keyof typeof STAGE_PERCENT;

interface Status {
    text: string;
    percent: number;
}

const PITCH_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

function pitchName(pitch: number): string {
    return `${PITCH_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

function messageOf(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
}

function timestamp(ms: number): string {
    const seconds = ms / 1000;
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * How long the score may take verovio to read before the page gives up on it.
 *
 * Nothing has been seen to come near this: a document verovio cannot lay out
 * comes back in milliseconds, and the flagship score reads in about a second.
 * It is here so that a document which did take for ever could not leave the page
 * busy with no way out.
 */
const SCORE_READ_TIMEOUT_MS = 120_000;

async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });

    try {
        return await Promise.race([work, limit]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * The notes of the score, or a sentence saying why there are none.
 *
 * Verovio does not fail on a document it cannot make sense of: `loadData`
 * returns false and `renderToTimemap` hands back an empty object instead of a
 * list, which `getNotesFromMEI` then walks into a `TypeError`. That does reach
 * the catch — but "timemap is not iterable" tells the person who chose the file
 * nothing at all, so it is turned into something they can act on and the
 * original is left in the console for whoever is debugging.
 */
async function readScore(mei: string) {
    // Both options are what the model was trained against: partitura keeps a
    // unison written in two voices as two notes, and the onsets it reads are the
    // notated ones, not the ones verovio would play an arpeggio or a grace note
    // at.
    const reading = getNotesFromMEI(mei, {
        collapseUnisons: false,
        notatedOnsets: true,
    }).catch((cause: unknown) => {
        console.warn("MLign: verovio could not read this score", cause);
        throw new Error(
            "That score could not be read as music. The file is XML, but the notation in " +
                "it could not be laid out — check that it opens in another MEI viewer."
        );
    });

    return withTimeout(
        reading,
        SCORE_READ_TIMEOUT_MS,
        "This score is taking too long to read. It may be far larger than the browser can " +
            "lay out, or the file may be damaged."
    );
}

export default function MLignApp() {
    const [mei, setMEI] = useState<string>();
    const [meiName, setMeiName] = useState<string>();
    const [midi, setMIDI] = useState<MidiFile>();
    const [midiName, setMidiName] = useState<string>();

    const [status, setStatus] = useState<Status>();
    const [error, setError] = useState<string>();
    /** What is wrong with the file chosen for each side, if anything */
    const [scoreProblem, setScoreProblem] = useState<string>();
    const [performanceProblem, setPerformanceProblem] = useState<string>();
    /** The two files do not look like the same music; the reader may insist */
    const [mismatch, setMismatch] = useState<string>();
    const [result, setResult] = useState<AlignResult>();
    const [notices, setNotices] = useState<string[]>([]);
    /**
     * Matches the model found in a passage the engraving cannot show — a repeat
     * verovio unfolded while reading the score but draws only once.
     */
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    const [minConfidence, setMinConfidence] = useState(0);
    const [sliderValue, setSliderValue] = useState(0);
    const [scale, setScale] = useState(DEFAULT_SCALE);

    const scoreRef = useRef<HTMLDivElement>(null);

    /**
     * A file is checked as it arrives, and only a file that can be read is kept.
     * Nothing further down is allowed to meet a file it cannot make sense of:
     * `asSpans` walks off the end of anything that is not a MIDI file, and it is
     * called while rendering, where a throw takes the whole page down with no
     * error anywhere to show for it.
     */
    const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        reset();
        // A new choice replaces the old one, whether or not it turns out to be
        // readable — otherwise a rejected file leaves the previous score loaded
        // under the new file's name
        setMEI(undefined);
        setMeiName(undefined);
        setScoreProblem(undefined);

        const reader = new FileReader();
        reader.onerror = () => setScoreProblem(`${file.name} could not be read from disk.`);
        reader.onload = () => {
            const text = reader.result as string;
            const problem = checkScore(text);
            if (problem) {
                setScoreProblem(problem);
                return;
            }
            setMEI(text);
            setMeiName(file.name);
        };
        reader.readAsText(file);
    };

    const handleMIDI = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        reset();
        setMIDI(undefined);
        setMidiName(undefined);
        setPerformanceProblem(undefined);

        const reader = new FileReader();
        reader.onerror = () =>
            setPerformanceProblem(`${file.name} could not be read from disk.`);
        reader.onload = () => {
            const bytes = reader.result as ArrayBuffer;
            const problem = checkPerformance(bytes);
            if (problem) {
                setPerformanceProblem(problem);
                return;
            }

            let parsed: MidiFile;
            try {
                parsed = read(bytes);
                // The magic bytes were right, so this is a MIDI file of some
                // kind; walking it here is what proves the rest of it reads.
                asSpans(parsed, true);
            } catch {
                setPerformanceProblem(
                    "That performance file could not be read as MIDI. It may be damaged or " +
                        "incomplete — try exporting it again."
                );
                return;
            }

            setMIDI(parsed);
            setMidiName(file.name);
        };
        reader.readAsArrayBuffer(file);
    };

    /**
     * A new upload invalidates whatever was aligned before it.
     *
     * What it does not touch is what is wrong with the *other* file: choosing a
     * MIDI file must not clear the reason the score was refused, or the reader
     * is left with a disabled Align button and nothing on screen saying why.
     */
    const reset = () => {
        setResult(undefined);
        setError(undefined);
        setMismatch(undefined);
        setNotices([]);
        setHidden(new Set());
    };

    /**
     * The whole run, from reading the score to handing the alignment on: every
     * step of it is inside the one try, and the finally clears the busy state
     * whatever happened. Anything that escapes leaves the page waiting for ever
     * with nothing on screen to say why.
     */
    const align = async (allowMismatch = false) => {
        if (!mei || !midi) return;

        reset();
        let drawing = false;
        const at = (stage: Stage, text: string, within = 0) =>
            setStatus({
                text,
                percent:
                    STAGE_PERCENT[stage] +
                    within * (nextPercent(stage) - STAGE_PERCENT[stage]),
            });

        try {
            at("score", "Reading the score…");
            // Verovio reads the whole score in one synchronous stretch, so the
            // status line has to reach the screen before it starts
            await new Promise((resolve) => setTimeout(resolve, 0));
            const scoreNotes = await readScore(mei);
            const spans = asSpans(midi, true).filter(
                (span): span is NoteSpan => span.type === "note"
            );

            const onProgress = (progress: AlignProgress) => {
                if (progress.stage === "running") {
                    const done = progress.done ?? 0;
                    const total = progress.total ?? 1;
                    at(
                        "running",
                        total > 1
                            ? `Running the model, passage ${Math.min(done + 1, total)} of ${total}…`
                            : "Running the model…",
                        total > 0 ? done / total : 0
                    );
                } else if (progress.stage === "loading") {
                    at("loading", "Loading the alignment model (3 MB)…");
                } else if (progress.stage === "featurizing") {
                    at("featurizing", "Preparing the notes…");
                } else {
                    at("decoding", "Working out the alignment…");
                }
            };

            const aligned = await alignScoreToPerformance(scoreNotes, spans, {
                onProgress,
                allowMismatch,
            });

            // Verovio reads a repeat that is written with repeat signs as two
            // passes and mints an id for the second one, which the document does
            // not hold and the engraving never shows. Those notes are worth
            // aligning — they really were played — but their matches cannot be
            // written into the MEI.
            const unshowable = unshowableScoreIds(mei, aligned.matches);

            const messages: string[] = [];
            if (unshowable.size > 0) {
                messages.push(
                    `${unshowable.size} notes of a repeated passage were aligned but cannot be ` +
                        `shown. The score writes the repeat with repeat signs, so it is engraved ` +
                        `once; only the first time through can be drawn.`
                );
            } else if (hasRepeatSigns(mei)) {
                messages.push(
                    `This score has repeat signs and is not written out. The repeats are not ` +
                        `unfolded, so everything the performer played on a repeat is reported as ` +
                        `an extra note.`
                );
            }
            if (hasUntimedGraceNotes(mei)) {
                messages.push(
                    `This score writes grace notes but records nothing about where they fall ` +
                        `in the notation, so they are aligned from the moment verovio would ` +
                        `play them — just before the beat they lean on — rather than from the ` +
                        `beat itself.`
                );
            }
            if (aligned.stats.skippedScoreNotes > 0) {
                messages.push(
                    `${aligned.stats.skippedScoreNotes} notes in the score have no pitch this ` +
                        `aligner could read and were left out of the alignment.`
                );
            }
            if (aligned.stats.skippedPerformedNotes > 0) {
                messages.push(
                    `${aligned.stats.skippedPerformedNotes} notes in the MIDI file have no ` +
                        `readable pitch or time and were left out of the alignment.`
                );
            }

            setNotices(messages);
            setHidden(unshowable);
            setResult(aligned);
            setStatus({ text: "Drawing the score…", percent: STAGE_PERCENT.rendering });
            drawing = true;
        } catch (reason: unknown) {
            if (reason instanceof MismatchedPairError) {
                // Not a failure the reader can do nothing about: it is a
                // judgement, and they are allowed to overrule it
                setMismatch(reason.message);
            } else {
                setError(reason instanceof Error ? reason.message : String(reason));
            }
        } finally {
            // Only a finished alignment leaves a status up, for the drawing that
            // follows it. Every other way out of here clears it, or the page is
            // left busy for ever with nothing to say why.
            if (!drawing) setStatus(undefined);
        }
    };

    /**
     * The score is laid out from the <when> elements, so the matching is written
     * into the MEI before it is rendered. `applyAlignment` appends its recording
     * after any the document already carried, and verovio lays out the first one
     * unless it is told otherwise — hence the explicit index.
     */
    const performed = useMemo(() => {
        if (!mei || !midi || !result) return undefined;

        const pairs = toMatches(result.matches, minConfidence).filter(
            (pair) => !hidden.has(pair.score_id)
        );
        try {
            const aligned = applyAlignment(mei, midi, pairs);
            const recordings = aligned.match(/<recording\b/g)?.length ?? 1;
            return { mei: aligned, recording: String(recordings), failed: undefined };
        } catch (reason: unknown) {
            // This runs while rendering, where a throw takes down the page and
            // leaves nothing to read
            return {
                mei: undefined,
                recording: undefined,
                failed: `The alignment could not be written into the score. ${messageOf(reason)}`,
            };
        }
    }, [mei, midi, result, minConfidence, hidden]);

    /**
     * Colour the noteheads once the pages are in the document. The score arrives
     * asynchronously and re-renders whenever the options change, so the painting
     * follows the container rather than a render of this component. Class
     * changes are attribute mutations, which this observer does not watch, so
     * painting cannot retrigger itself.
     *
     * The notes that went unplayed are painted here rather than left to
     * verovio's own `data-perf-unaligned`: it only marks a note it could not
     * place at all, and a note in a chord or under a tie whose neighbours were
     * matched is placed from theirs, so most deletions would go unmarked.
     */
    useLayoutEffect(() => {
        const root = scoreRef.current;
        if (!root || !performed?.mei) return;

        const matched = new Set(
            toMatches(result?.matches ?? [], minConfidence)
                .map((pair) => pair.score_id)
                .filter((id) => !hidden.has(id))
        );
        const unplayed = new Set([
            ...(result?.deletions ?? []).map((deletion) => deletion.scoreId),
            // A match the reader asked not to see stands in the score as unplayed
            ...(result?.matches ?? [])
                .filter((match) => match.confidence < minConfidence)
                .map((match) => match.scoreId),
        ]);

        const paint = () => {
            for (const element of root.querySelectorAll(".mlign-matched, .mlign-unplayed")) {
                element.classList.remove("mlign-matched", "mlign-unplayed");
            }
            const find = (id: string) =>
                root.querySelector(
                    `[data-id="${typeof CSS?.escape === "function" ? CSS.escape(id) : id}"]`
                );
            for (const id of matched) find(id)?.classList.add("mlign-matched");
            for (const id of unplayed) find(id)?.classList.add("mlign-unplayed");

            // The score is what the last stage was waiting for — or the <p>
            // <PerformedScore> puts there instead when verovio refuses the
            // document, which must end the wait just as surely
            if (root.querySelector(".note, p")) setStatus(undefined);
        };

        paint();
        const observer = new MutationObserver(paint);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [performed, result, minConfidence, hidden]);

    const spans = useMemo(
        () =>
            midi
                ? asSpans(midi, true).filter((span): span is NoteSpan => span.type === "note")
                : [],
        [midi]
    );

    const insertions = useMemo(() => {
        if (!result) return [];
        const byId = new Map(spans.map((span) => [span.id, span]));
        return result.insertions
            .map((insertion) => byId.get(insertion.performanceId))
            .filter((span): span is NoteSpan => span !== undefined)
            .sort((a, b) => a.onsetMs - b.onsetMs);
    }, [result, spans]);

    const busy = status !== undefined;
    const filteredOut = result
        ? result.matches.filter(
              (match) => !hidden.has(match.scoreId) && match.confidence < minConfidence
          ).length
        : 0;

    return (
        <Box sx={{ p: 2, backgroundColor: "#ffffff" }}>
            <GlobalStyles styles={scoreStyles} />

            <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "baseline" }}>
                    <Typography variant="h6">Align a score to a performance</Typography>
                    <Link to="/">Back to Viewer</Link>
                    <Link to="/editor">Editor</Link>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "48rem" }}>
                    Upload the score as MEI and a recording of it as MIDI. The alignment is
                    worked out here in the browser, note by note, and the score is then drawn
                    along the time it was played in.
                </Typography>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Button variant="outlined" component="label" disabled={busy}>
                        {meiName ?? "Upload MEI"}
                        <input type="file" hidden accept=".mei,.xml" onChange={handleMEI} />
                    </Button>

                    <Button variant="outlined" component="label" disabled={busy}>
                        {midiName ?? "Upload MIDI"}
                        <input type="file" hidden accept=".midi,.mid" onChange={handleMIDI} />
                    </Button>

                    <Button
                        variant="contained"
                        onClick={() => align()}
                        disabled={!mei || !midi || busy}
                    >
                        {result ? "Align again" : "Align"}
                    </Button>

                    {result && (
                        <>
                            <Typography variant="body2" sx={{ pl: 2 }}>
                                Zoom
                            </Typography>
                            <Slider
                                sx={{ width: "6rem" }}
                                min={4}
                                max={64}
                                step={2}
                                value={scale}
                                onChange={(_, value) => setScale(value as number)}
                                valueLabelDisplay="auto"
                                disabled={busy}
                            />
                        </>
                    )}
                </Stack>

                {status && (
                    <Box sx={{ maxWidth: "32rem" }}>
                        <Typography variant="body2" color="text.secondary">
                            {status.text}
                        </Typography>
                        <LinearProgress variant="determinate" value={status.percent} />
                    </Box>
                )}

                {scoreProblem && (
                    <Alert severity="error" sx={{ maxWidth: "48rem" }}>
                        {scoreProblem}
                    </Alert>
                )}

                {performanceProblem && (
                    <Alert severity="error" sx={{ maxWidth: "48rem" }}>
                        {performanceProblem}
                    </Alert>
                )}

                {error && (
                    <Alert
                        severity="error"
                        sx={{ maxWidth: "48rem" }}
                        onClose={() => setError(undefined)}
                    >
                        {error}
                    </Alert>
                )}

                {mismatch && (
                    <Alert
                        severity="warning"
                        sx={{ maxWidth: "48rem" }}
                        action={
                            <Button color="inherit" size="small" onClick={() => align(true)}>
                                Align anyway
                            </Button>
                        }
                    >
                        {mismatch}
                    </Alert>
                )}

                {notices.map((notice) => (
                    <Alert severity="warning" key={notice}>
                        {notice}
                    </Alert>
                ))}

                {result && (
                    <Paper variant="outlined" sx={{ p: 2, maxWidth: "48rem" }}>
                        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
                            <Count
                                value={result.matches.length}
                                label="notes matched"
                                colour={MATCHED_COLOUR}
                            />
                            <Count value={result.deletions.length} label="notes not played" />
                            <Count value={result.insertions.length} label="notes not in the score" />
                        </Stack>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                            A note <strong>not played</strong> stands in the score but nothing in
                            the recording answers to it — a note the performer left out, one the
                            piano roll missed, or a passage the recording never reaches. Those
                            notes are drawn in grey, near where they would have fallen.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            A note <strong>not in the score</strong> was played but has no note to
                            belong to — an ornament that is not written out, an added bass, or a
                            repeat the engraving shows only once. It has nowhere to go in the
                            score and is listed below instead.
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                            {result.stats.scoreNotes} notes in the score ·{" "}
                            {result.stats.performedNotes} notes played ·{" "}
                            {result.stats.windows > 1
                                ? `${result.stats.windows} passages · `
                                : ""}
                            aligned in {(totalTime(result) / 1000).toFixed(1)} s
                        </Typography>

                        <Box sx={{ mt: 2, maxWidth: "24rem" }}>
                            <Typography variant="body2">
                                Show only matches the model is at least{" "}
                                {Math.round(sliderValue * 100)}% sure of
                                {filteredOut > 0 ? ` (${filteredOut} left out)` : ""}
                            </Typography>
                            <Slider
                                min={0}
                                max={0.95}
                                step={0.05}
                                value={sliderValue}
                                onChange={(_, value) => setSliderValue(value as number)}
                                onChangeCommitted={(_, value) => setMinConfidence(value as number)}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(value: number) => `${Math.round(value * 100)}%`}
                            />
                        </Box>
                    </Paper>
                )}

                {insertions.length > 0 && (
                    <Accordion variant="outlined" sx={{ maxWidth: "48rem" }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            {insertions.length} played notes with no note in the score
                        </AccordionSummary>
                        <AccordionDetails sx={{ maxHeight: "20rem", overflow: "auto" }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Time</TableCell>
                                        <TableCell>Pitch</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {insertions.slice(0, 200).map((span) => (
                                        <TableRow key={span.id}>
                                            <TableCell>{timestamp(span.onsetMs)}</TableCell>
                                            <TableCell>{pitchName(span.pitch)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {insertions.length > 200 && (
                                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                    and {insertions.length - 200} more
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                )}

                {performed?.failed && <Alert severity="error">{performed.failed}</Alert>}

                {performed?.mei && (
                    <Box sx={{ overflowX: "auto" }}>
                        <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: "center" }}>
                            <Chip
                                size="small"
                                label="matched"
                                sx={{ backgroundColor: MATCHED_COLOUR, color: "#ffffff" }}
                            />
                            <Chip
                                size="small"
                                label="not played"
                                sx={{ backgroundColor: UNPLAYED_COLOUR }}
                            />
                        </Stack>

                        <div ref={scoreRef}>
                            <PerformedScore
                                className="mlign-score"
                                mei={performed.mei}
                                extenders
                                options={{
                                    performanceScale: scale,
                                    performanceRecording: performed.recording,
                                }}
                            />
                        </div>
                    </Box>
                )}
            </Stack>
        </Box>
    );
}

/** The stage after this one, for interpolating within a stage. */
function nextPercent(stage: Stage): number {
    const stages = Object.keys(STAGE_PERCENT) as Stage[];
    const next = stages[stages.indexOf(stage) + 1];
    return next ? STAGE_PERCENT[next] : 100;
}

function totalTime(result: AlignResult): number {
    return Object.values(result.stats.timings).reduce((sum, ms) => sum + ms, 0);
}

const Count = ({
    value,
    label,
    colour,
}: {
    value: number;
    label: string;
    colour?: string;
}) => (
    <Box>
        <Typography variant="h5" sx={{ color: colour ?? "text.primary" }}>
            {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
            {label}
        </Typography>
    </Box>
);
