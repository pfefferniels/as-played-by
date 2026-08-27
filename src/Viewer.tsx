import { useCallback, useEffect, useMemo, useState } from "react";
import { usePiano } from "react-pianosound";
import type { AnyEvent } from "midifile-ts";
import "./App.css";
import { AlignedMEI } from "./AlignedMEI";
import { NoteSpan } from "./MidiSpans";
import { getNotesFromMEI } from "./NaiveAligner";
import { parseRecordings } from "./parseRecordings";
import { buildMidiFile } from "./buildMidiFile";

const DEFAULT_STRETCH = 0.05;
const STRETCH_MULTIPLIER = 14.1;

function highlightNote(noteId: string) {
    // Try SCORE mode (data-mei-id) then Verovio mode (id attribute)
    const el =
        document.querySelector(`[data-mei-id="${noteId}"]`) ||
        document.getElementById(noteId);
    if (!el) return;

    el.classList.add("note-playing");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    setTimeout(() => {
        el.classList.remove("note-playing");
    }, 600);
}

function ScoreSVGViewer({ svgContent }: { svgContent: string }) {
    return (
        <div
            style={{ width: "100vw", overflow: "scroll", position: "relative" }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
}

export default function Viewer() {
    const [mei, setMEI] = useState<string>();
    const [recordings, setRecordings] = useState<
        Awaited<ReturnType<typeof parseRecordings>>["recordings"]
    >([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [pitchMap, setPitchMap] = useState<Map<string, number>>(new Map());
    const [isPlaying, setIsPlaying] = useState(false);
    const [duplicateNoteIDs, setDuplicateNoteIDs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    // Per-recording SVGs: index → SVG string
    const [scoreSVGs, setScoreSVGs] = useState<Map<number, string>>(new Map());
    // Whether we're in SCORE SVG mode (at least one SVG loaded)
    const hasScoreSVGs = scoreSVGs.size > 0;
    const currentSVG = scoreSVGs.get(selectedIdx) ?? null;

    const { play, stop, status } = usePiano();

    const selectedRecording = recordings[selectedIdx];

    // Derive spanMap from selected recording for Verovio fallback
    const spanMap = useMemo<Map<string, NoteSpan>>(
        () => selectedRecording?.noteSpans ?? new Map(),
        [selectedRecording]
    );

    const midiFile = useMemo(() => {
        if (!selectedRecording || pitchMap.size === 0) return null;
        return buildMidiFile(selectedRecording, pitchMap);
    }, [selectedRecording, pitchMap]);

    useEffect(() => {
        const load = async () => {
            try {
                // Always load MEI for recording data
                const meiResponse = await fetch(
                    `${import.meta.env.BASE_URL}transcription.mei`
                );
                if (!meiResponse.ok) {
                    setError("Failed to load transcription.mei");
                    setLoading(false);
                    return;
                }
                const meiText = await meiResponse.text();
                setMEI(meiText);

                // Parse recordings
                const { recordings: recs, pitchMap: pm } =
                    parseRecordings(meiText);
                setRecordings(recs);
                setPitchMap(pm);
                if (recs.length > 0) setSelectedIdx(0);

                // Try to load per-recording SCORE SVGs
                // Convention: transcription.score.0.svg, transcription.score.1.svg, ...
                // Falls back to single transcription.score.svg for backwards compat
                const svgMap = new Map<number, string>();

                if (recs.length > 1) {
                    for (let i = 0; i < recs.length; i++) {
                        const resp = await fetch(
                            `${import.meta.env.BASE_URL}transcription.score.${i}.svg`
                        );
                        if (resp.ok) svgMap.set(i, await resp.text());
                    }
                }

                // Fallback: single SVG (no per-recording files)
                if (svgMap.size === 0) {
                    const resp = await fetch(
                        `${import.meta.env.BASE_URL}transcription.score.svg`
                    );
                    if (resp.ok) {
                        const svgText = await resp.text();
                        for (let i = 0; i < Math.max(1, recs.length); i++) {
                            svgMap.set(i, svgText);
                        }
                    }
                }

                if (svgMap.size > 0) {
                    setScoreSVGs(svgMap);
                } else {
                    // Fall back to Verovio rendering
                    const { duplicateNoteIDs: dups } =
                        await getNotesFromMEI(meiText);
                    setDuplicateNoteIDs(dups);
                }
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handlePlay = useCallback(() => {
        if (!midiFile) return;
        setIsPlaying(true);
        play(midiFile, (event: AnyEvent) => {
            if (
                event.type === "meta" &&
                event.subtype === "text" &&
                "text" in event
            ) {
                highlightNote((event as AnyEvent & { text: string }).text);
            }
        });
    }, [midiFile, play]);

    const handleStop = useCallback(() => {
        stop();
        setIsPlaying(false);
        document.querySelectorAll(".note-playing").forEach((el) => {
            el.classList.remove("note-playing");
        });
    }, [stop]);

    const getSpanForNote = useCallback(
        (id: string) => spanMap.get(id),
        [spanMap]
    );

    const noop = useCallback(() => {}, []);

    if (loading) return <p>Loading score&hellip;</p>;
    if (error) return <p style={{ color: "red" }}>{error}</p>;

    return (
        <div className="viewer-mode" style={{ padding: "1rem" }}>
            <div
                style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    marginBottom: "1rem",
                }}
            >
                {recordings.length > 1 && (
                    <select
                        value={selectedIdx}
                        onChange={(e) => {
                            handleStop();
                            setSelectedIdx(Number(e.target.value));
                        }}
                    >
                        {recordings.map((r, i) => (
                            <option key={r.source} value={i}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    onClick={isPlaying ? handleStop : handlePlay}
                    disabled={!midiFile || status !== "done"}
                >
                    {isPlaying ? "Stop" : "Play"}
                </button>
                {status === "loading" && <span>Loading piano&hellip;</span>}
            </div>

            {hasScoreSVGs && currentSVG ? (
                <ScoreSVGViewer svgContent={currentSVG} />
            ) : (
                <div
                    style={{
                        width: "100vw",
                        overflow: "scroll",
                        position: "relative",
                    }}
                >
                    {mei && (
                        <AlignedMEI
                            mei={mei}
                            duplicateNoteIDs={duplicateNoteIDs}
                            getSpanForNote={getSpanForNote}
                            stretchX={DEFAULT_STRETCH * STRETCH_MULTIPLIER}
                            onClick={noop}
                            onHover={noop}
                        />
                    )}
                </div>
            )}

            <footer
                style={{
                    textAlign: "left",
                    padding: "0.5rem 0",
                    marginTop: "1rem",
                }}
            >
                &copy; {new Date().getFullYear()} Niels Pfeffer
            </footer>
        </div>
    );
}
