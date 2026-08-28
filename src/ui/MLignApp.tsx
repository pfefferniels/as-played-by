import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { read, type MidiFile } from "midifile-ts";
import {
    Alert,
    Box,
    Button,
    Chip,
    GlobalStyles,
    LinearProgress,
    MenuItem,
    Paper,
    Slider,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { Download } from "@mui/icons-material";
import { asSpans, type NoteSpan } from "../performance/midiSpans";
import { getNotesFromMEI, type ScoreNote } from "../score/scoreNotes";
import { applyAlignment } from "../alignment/applyAlignment";
import { PerformedScore } from "../verovio/PerformedScore";
import { DEFAULT_PERFORMANCE_SCALE } from "../verovio/toolkit";
import type { ExtraNote } from "../verovio/extraNotes";
import { chosenFile, readAsArrayBuffer, readAsText } from "./fileInput";
import { divergencesOf, type Divergence } from "../alignment/divergences";
import { ornamentSignsOf } from "../mei/ornamentSigns";
import { addOrnamentSign, addPlayedNotes, markUnplayed, replaceWithPlayed } from "../mei/editScore";
import { DivergencePopover } from "./DivergencePopover";
import {
    CERTAINTIES,
    changesNotation,
    defaultAction,
    type Attribution,
    type Resolution,
} from "./divergenceReadings";
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
} from "../alignment/mlign";

/** Matched noteheads, and the notes the recording never reached */
const MATCHED_COLOUR = "#1d4ed8";
const UNPLAYED_COLOUR = "#c9ced6";
/** The played notes with no note in the score, drawn as crosses */
const EXTRA_COLOUR = "#b45309";
const SELECTED_COLOUR = "#dc2626";
/** A written note the recording played as something else: sounded, but not as written */
const REPLACED_COLOUR = "#7c3aed";

const scoreStyles = {
    ".mlign-score .mlign-matched, .mlign-score .mlign-matched *": {
        fill: `${MATCHED_COLOUR} !important`,
        stroke: `${MATCHED_COLOUR} !important`,
    },
    ".mlign-score .mlign-unplayed, .mlign-score .mlign-unplayed *": {
        fill: `${UNPLAYED_COLOUR} !important`,
        stroke: `${UNPLAYED_COLOUR} !important`,
    },
    ".mlign-score .mlign-replaced, .mlign-score .mlign-replaced *": {
        fill: `${REPLACED_COLOUR} !important`,
        stroke: `${REPLACED_COLOUR} !important`,
    },
    ".mlign-score [data-perf-unaligned], .mlign-score [data-perf-unaligned] *": {
        fill: `${UNPLAYED_COLOUR} !important`,
        stroke: `${UNPLAYED_COLOUR} !important`,
    },
    // The divergence the reader has picked out, in the score and in the list
    ".mlign-score .mlign-selected, .mlign-score .mlign-selected *": {
        stroke: `${SELECTED_COLOUR} !important`,
        fill: `${SELECTED_COLOUR} !important`,
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

function messageOf(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
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
    const [scale, setScale] = useState(DEFAULT_PERFORMANCE_SCALE);

    /** The notes of the score, kept so divergences can be built from them */
    const [scoreNotes, setScoreNotes] = useState<ScoreNote[]>([]);
    /** What the reader has decided about each divergence */
    const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map());
    const [attribution, setAttribution] = useState<Attribution>({
        resp: "",
        certainty: "medium",
    });
    /** The divergence the reader has opened, and the notehead they opened it on */
    const [selected, setSelected] = useState<string>();
    const [anchorEl, setAnchorEl] = useState<Element>();

    const scoreRef = useRef<HTMLDivElement>(null);

    /**
     * A file is checked as it arrives, and only a file that can be read is kept.
     * Nothing further down is allowed to meet a file it cannot make sense of:
     * `asSpans` walks off the end of anything that is not a MIDI file, and it is
     * called while rendering, where a throw takes the whole page down with no
     * error anywhere to show for it.
     */
    const handleMEI = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = chosenFile(event);
        if (!file) return;

        reset();
        // A new choice replaces the old one, whether or not it turns out to be
        // readable — otherwise a rejected file leaves the previous score loaded
        // under the new file's name
        setMEI(undefined);
        setMeiName(undefined);
        setScoreProblem(undefined);

        let text: string;
        try {
            text = await readAsText(file);
        } catch (cause) {
            setScoreProblem(messageOf(cause));
            return;
        }

        const problem = checkScore(text);
        if (problem) {
            setScoreProblem(problem);
            return;
        }
        setMEI(text);
        setMeiName(file.name);
    };

    const handleMIDI = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = chosenFile(event);
        if (!file) return;

        reset();
        setMIDI(undefined);
        setMidiName(undefined);
        setPerformanceProblem(undefined);

        let bytes: ArrayBuffer;
        try {
            bytes = await readAsArrayBuffer(file);
        } catch (cause) {
            setPerformanceProblem(messageOf(cause));
            return;
        }

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
        setScoreNotes([]);
        setResolutions(new Map());
        setSelected(undefined);
        setAnchorEl(undefined);
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
            const notes = await readScore(mei);
            setScoreNotes(notes);
            const scoreNotes = notes;
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

    const spans = useMemo(
        () =>
            midi
                ? asSpans(midi, true).filter((span): span is NoteSpan => span.type === "note")
                : [],
        [midi]
    );

    /**
     * The disagreements, grouped into the things they actually are.
     *
     * The ornament signs are read from the score for this and nothing else: a run
     * of played notes against a note the score already puts a trill on is that
     * trill being performed, not notes the performer added, and no amount of
     * looking at the played notes alone can tell the difference.
     */
    const divergences = useMemo(() => {
        if (!mei || !result) return [];

        return divergencesOf(
            {
                matches: result.matches,
                deletions: result.deletions,
                insertions: result.insertions,
                scoreNotes,
                spans,
                signs: ornamentSignsOf(mei),
            },
            { hasRepeats: hasRepeatSigns(mei) }
        );
    }, [mei, result, scoreNotes, spans]);

    /**
     * The score is laid out from the <when> elements, so the matching is written
     * into the MEI before it is rendered. `applyAlignment` appends its recording
     * after any the document already carried, and verovio lays out the first one
     * unless it is told otherwise — hence the explicit index.
     *
     * The divergences go into the same recording. The fork ignores a <when> it
     * cannot resolve, so they change nothing about the layout and everything
     * about what survives being saved.
     */
    const performed = useMemo(() => {
        if (!mei || !midi || !result) return undefined;

        const pairs = toMatches(result.matches, minConfidence).filter(
            (pair) => !hidden.has(pair.score_id)
        );
        try {
            const aligned = applyAlignment(mei, midi, pairs, {
                divergences,
                resolutions: new Map(
                    [...resolutions].map(([id, resolution]) => [
                        id,
                        {
                            reading: resolution.reading,
                            action: resolution.action,
                            resp: attribution.resp || undefined,
                            certainty: attribution.certainty,
                        },
                    ])
                ),
            });
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
    }, [mei, midi, result, minConfidence, hidden, divergences, resolutions, attribution]);

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
        // A written note that was played as another note is not unplayed: it
        // sounded, and the score shows it in its own colour rather than as one
        // of the notes the recording never reached.
        const replaced = new Map(
            divergences
                .filter((divergence) => divergence.kind === "replaced")
                .map((divergence) => [divergence.scoreId, divergence.id])
        );

        const unplayed = new Set(
            [
                ...(result?.deletions ?? []).map((deletion) => deletion.scoreId),
                // A match the reader asked not to see stands in the score as unplayed
                ...(result?.matches ?? [])
                    .filter((match) => match.confidence < minConfidence)
                    .map((match) => match.scoreId),
            ].filter((id) => !replaced.has(id))
        );

        // Which divergence each note the recording disagreed about belongs to, so
        // that clicking one asks about it. The crosses carry this already; a
        // notehead is something verovio drew, so it has to be told here.
        const divergenceOfNote = new Map<string, string>(replaced);
        for (const divergence of divergences) {
            if (divergence.kind !== "missing") continue;
            for (const id of divergence.scoreIds) divergenceOfNote.set(id, divergence.id);
        }

        const chosen = divergences.find((divergence) => divergence.id === selected);

        const paint = () => {
            for (const element of root.querySelectorAll(
                ".mlign-matched, .mlign-unplayed, .mlign-replaced, .mlign-selected"
            )) {
                element.classList.remove(
                    "mlign-matched",
                    "mlign-unplayed",
                    "mlign-replaced",
                    "mlign-selected"
                );
            }
            const find = (id: string) =>
                root.querySelector(
                    `[data-id="${typeof CSS?.escape === "function" ? CSS.escape(id) : id}"]`
                );
            for (const id of matched) find(id)?.classList.add("mlign-matched");
            for (const id of unplayed) {
                const element = find(id);
                if (!element) continue;

                element.classList.add("mlign-unplayed");
                const divergenceId = divergenceOfNote.get(id);
                if (divergenceId) {
                    element.setAttribute("data-divergence", divergenceId);
                    (element as SVGElement).style.cursor = "pointer";
                }
            }
            for (const [id, divergenceId] of replaced) {
                const element = find(id);
                if (!element) continue;

                element.classList.add("mlign-replaced");
                element.setAttribute("data-divergence", divergenceId);
                (element as SVGElement).style.cursor = "pointer";
            }

            // What the reader currently has open, so the popover and the music
            // agree about which notes are being talked about
            if (chosen) {
                const ids =
                    chosen.kind === "added"
                        ? chosen.anchorId
                            ? [chosen.anchorId]
                            : []
                        : chosen.kind === "replaced"
                          ? [chosen.scoreId]
                          : chosen.scoreIds;
                for (const id of ids) find(id)?.classList.add("mlign-selected");

                for (const cross of root.querySelectorAll(
                    `[data-divergence="${chosen.id}"]`
                )) {
                    cross.classList.add("mlign-selected");
                }
            }

            // The score is what the last stage was waiting for — or the <p>
            // <PerformedScore> puts there instead when verovio refuses the
            // document, which must end the wait just as surely
            if (root.querySelector(".note, p")) setStatus(undefined);
        };

        paint();
        const observer = new MutationObserver(paint);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [performed, result, minConfidence, hidden, divergences, selected]);

    /**
     * The extra notes to draw, each carrying the divergence a click selects.
     *
     * A substitution draws one too, at the pitch actually struck, so that the
     * written note and what was played in its place stand one above the other at
     * the same moment. Where the two are the same pitch there is nothing to draw:
     * the notehead already sits exactly where the cross would go, and the note
     * itself is the whole story.
     */
    const extraNotes = useMemo<ExtraNote[]>(() => {
        const byId = new Map(spans.map((span) => [span.id, span]));
        const cross = (divergence: Divergence, perfId: string): ExtraNote[] => {
            const span = byId.get(perfId);
            if (!span) return [];
            return [
                {
                    id: span.id,
                    divergenceId: divergence.id,
                    onsetMs: span.onsetMs,
                    offsetMs: span.offsetMs,
                    pitch: span.pitch,
                    resolved: resolutions.has(divergence.id),
                },
            ];
        };

        return divergences.flatMap((divergence) => {
            if (divergence.kind === "added") {
                return divergence.perfIds.flatMap((perfId) => cross(divergence, perfId));
            }
            if (divergence.kind === "replaced" && divergence.reading !== "unmatched-pair") {
                return cross(divergence, divergence.perfId);
            }
            return [];
        });
    }, [divergences, spans, resolutions]);

    /**
     * Open the question at the note it is about.
     *
     * Every divergence is somewhere in this score already - a cross where an
     * extra note was played, a grey notehead where a written one was not - so
     * the click that asks about one is the click on it.
     */
    const handleScoreClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const element = (event.target as Element).closest?.("[data-divergence]");
        const id = element?.getAttribute("data-divergence");

        // The popover lets clicks through to the music beneath it, so a click on
        // ordinary notation is what closes it
        if (!id || !element) {
            setSelected(undefined);
            setAnchorEl(undefined);
            return;
        }

        setSelected(id);
        setAnchorEl(element);
    };

    /**
     * How many disagreements turned out to be one note played as another.
     *
     * Each of them is a deletion and an insertion the aligner reported apart, so
     * the two headline figures have to lose one apiece for every pair, or the
     * same event is counted twice under two names.
     */
    const replacedCount = useMemo(
        () => divergences.filter((divergence) => divergence.kind === "replaced").length,
        [divergences]
    );

    /** Those the reader has not settled yet, in the order they sound. */
    const undecided = useMemo(
        () => divergences.filter((divergence) => !resolutions.has(divergence.id)),
        [divergences, resolutions]
    );

    /**
     * Move to the next one that has not been settled, and scroll it into view.
     *
     * A divergence whose notes the engraving never draws - a repeat shown once,
     * a note verovio placed nowhere - is skipped rather than opened on nothing.
     */
    const goToNext = () => {
        const root = scoreRef.current;
        if (!root) return;

        const after = undecided.filter((divergence) => divergence.id !== selected);
        for (const divergence of after) {
            const element = root.querySelector(`[data-divergence="${divergence.id}"]`);
            if (!element) continue;

            element.scrollIntoView({ block: "center", inline: "center" });
            setSelected(divergence.id);
            setAnchorEl(element);
            return;
        }

        setSelected(undefined);
        setAnchorEl(undefined);
    };

    /**
     * Carry out the decisions that change the notation.
     *
     * Only these four do: everything else is a fact about the recording, which
     * is already written into it. The edited score replaces the one on the page,
     * so the next alignment sees the notes just added - which is what makes a
     * written-in note match rather than turn up as an addition all over again.
     */
    const applyToScore = () => {
        if (!mei) return;

        const doc = new DOMParser().parseFromString(mei, "application/xml");
        const byId = new Map(spans.map((span) => [span.id, span]));
        const who = { resp: attribution.resp || undefined, certainty: attribution.certainty };
        const tonic = "C";
        let changed = 0;

        for (const divergence of divergences) {
            const action = resolutions.get(divergence.id)?.action;
            if (!action || action === "record" || action === "ignore") continue;

            if (divergence.kind === "added" && divergence.anchorId) {
                if (action === "add-sign") {
                    if (addOrnamentSign(doc, divergence.anchorId, "trill", who)) changed++;
                } else if (action === "write-notes") {
                    const played = divergence.perfIds
                        .map((id) => byId.get(id))
                        .filter((span): span is NoteSpan => span !== undefined);
                    const reason =
                        divergence.reading === "added-octave" ||
                        divergence.reading === "fuller-chord" ||
                        divergence.reading === "ornamentation"
                            ? divergence.reading
                            : "unknown";
                    if (addPlayedNotes(doc, divergence.anchorId, played, reason, tonic, who)) {
                        changed++;
                    }
                }
            } else if (divergence.kind === "missing" && action === "mark-simplification") {
                if (markUnplayed(doc, divergence.scoreIds, who)) changed++;
            } else if (divergence.kind === "replaced" && action === "write-variant") {
                const played = byId.get(divergence.perfId);
                if (played && replaceWithPlayed(doc, divergence.scoreId, played, tonic, who)) {
                    changed++;
                }
            }
        }

        if (changed === 0) {
            setError("None of those decisions could be written into this score.");
            return;
        }

        setMEI(new XMLSerializer().serializeToString(doc));
        setNotices([
            `${changed} decision${changed === 1 ? "" : "s"} written into the score. ` +
                `Align again to see how the new notation matches.`,
        ]);
        setResolutions(new Map());
    };

    const download = () => {
        if (!performed?.mei) return;

        const url = URL.createObjectURL(
            new Blob([performed.mei], { type: "application/xml" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = (meiName ?? "score").replace(/\.[^.]+$/, "") + "-aligned.mei";
        link.click();
        URL.revokeObjectURL(url);
    };

    /** Decisions that would change the notation, which is what Apply carries out */
    const pendingEdits = divergences.filter((divergence) =>
        changesNotation(resolutions.get(divergence.id)?.action ?? defaultAction(divergence))
    ).length;

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

                    {performed?.mei && (
                        <Button
                            variant="outlined"
                            startIcon={<Download />}
                            onClick={download}
                            disabled={busy}
                        >
                            Download MEI
                        </Button>
                    )}

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
                            <Count
                                value={result.deletions.length - replacedCount}
                                label="notes not played"
                            />
                            <Count
                                value={result.insertions.length - replacedCount}
                                label="notes not in the score"
                            />
                            {replacedCount > 0 && (
                                <Count
                                    value={replacedCount}
                                    label="notes played differently"
                                    colour={REPLACED_COLOUR}
                                />
                            )}
                        </Stack>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                            A note <strong>not played</strong> stands in the score but nothing in
                            the recording answers to it — a note the performer left out, one the
                            piano roll missed, or a passage the recording never reaches. Those
                            notes are drawn in grey, near where they would have fallen.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            A note <strong>not in the score</strong> was played but has no note to
                            belong to. Most of them are not additions at all: an ornament sign
                            stands for its notes without writing them, so a written trill reaches
                            the aligner as one note and everything else the performer played
                            reaches it as extra. Those are drawn as crosses where they were
                            played, and sorted out below.
                        </Typography>
                        {replacedCount > 0 && (
                            <Typography variant="body2" color="text.secondary">
                                A note <strong>played differently</strong> is one of each: the
                                aligner found a written note nothing answered to and a played note
                                belonging to nothing, at the same moment, and they are the same
                                event — the performer played something else there. Counting them
                                twice would say a note was dropped and another added when one note
                                simply came out differently, so they are taken out of both figures
                                above.
                            </Typography>
                        )}

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
                            <Chip
                                size="small"
                                label="✕ played, not in the score"
                                variant="outlined"
                                sx={{ color: EXTRA_COLOUR, borderColor: EXTRA_COLOUR }}
                            />
                            {replacedCount > 0 && (
                                <Chip
                                    size="small"
                                    label="played differently"
                                    sx={{ backgroundColor: REPLACED_COLOUR, color: "#ffffff" }}
                                />
                            )}

                            <Box sx={{ flexGrow: 1 }} />

                            {/*
                              * The only chrome the review needs. Everything else
                              * is asked at the note it is about.
                              */}
                            {divergences.length > 0 && (
                                <>
                                    <Typography variant="body2" color="text.secondary">
                                        {undecided.length} of {divergences.length} undecided
                                    </Typography>
                                    <Button size="small" onClick={goToNext}>
                                        Go to next
                                    </Button>
                                    <TextField
                                        size="small"
                                        label="Decided by"
                                        value={attribution.resp}
                                        onChange={(event) =>
                                            setAttribution({
                                                ...attribution,
                                                resp: event.target.value,
                                            })
                                        }
                                        sx={{ width: "9rem" }}
                                    />
                                    <TextField
                                        size="small"
                                        select
                                        label="Certainty"
                                        value={attribution.certainty}
                                        onChange={(event) =>
                                            setAttribution({
                                                ...attribution,
                                                certainty: event.target.value,
                                            })
                                        }
                                        sx={{ width: "8rem" }}
                                    >
                                        {CERTAINTIES.map((certainty) => (
                                            <MenuItem key={certainty} value={certainty}>
                                                {certainty}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={applyToScore}
                                        disabled={pendingEdits === 0 || busy}
                                    >
                                        Apply {pendingEdits > 0 ? `${pendingEdits} ` : ""}to the
                                        score
                                    </Button>
                                </>
                            )}
                        </Stack>

                        <div ref={scoreRef} onClick={handleScoreClick}>
                            <PerformedScore
                                className="mlign-score"
                                mei={performed.mei}
                                extenders
                                extraNotes={extraNotes}
                                options={{
                                    performanceScale: scale,
                                    performanceRecording: performed.recording,
                                }}
                            />
                        </div>

                        <DivergencePopover
                            divergence={divergences.find(
                                (divergence) => divergence.id === selected
                            )}
                            anchor={anchorEl}
                            resolution={selected ? resolutions.get(selected) : undefined}
                            onResolve={(id, resolution) =>
                                setResolutions((previous) =>
                                    new Map(previous).set(id, resolution)
                                )
                            }
                            onClose={() => {
                                setSelected(undefined);
                                setAnchorEl(undefined);
                            }}
                            onNext={goToNext}
                            remaining={undecided.length}
                        />
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
