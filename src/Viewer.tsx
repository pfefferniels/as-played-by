import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { AlignedMEI } from "./AlignedMEI";
import { NoteSpan } from "./MidiSpans";
import { getNotesFromMEI } from "./NaiveAligner";

/**
 * Parse <when> elements from the MEI to build a map of
 * score note ID → NoteSpan (with onsetMs, offsetMs, velocity).
 */
function parseWhens(mei: string): Map<string, NoteSpan> {
    const doc = new DOMParser().parseFromString(mei, "application/xml");
    const ns = "http://www.music-encoding.org/ns/mei";
    const map = new Map<string, NoteSpan>();

    for (const when of doc.getElementsByTagNameNS(ns, "when")) {
        const absoluteAttr = when.getAttribute("absolute");
        const dataAttr = when.getAttribute("data");
        if (!absoluteAttr || !dataAttr) continue;

        const noteId = dataAttr.replace(/^#/, "");
        const onsetMs = parseInt(absoluteAttr, 10);

        const extDatas = when.getElementsByTagNameNS(ns, "extData");
        let velocity = 64;
        let durationMs = 0;
        let onsetTicks = 0;
        let durationTicks = 0;

        for (let i = 0; i < extDatas.length; i++) {
            const ext = extDatas[i];
            const type = ext.getAttribute("type");
            const text = ext.textContent || "";
            if (type === "velocity") velocity = parseInt(text, 10);
            else if (type === "duration") durationMs = parseInt(text, 10);
            else if (type === "onsetTicks") onsetTicks = parseInt(text, 10);
            else if (type === "durationTicks") durationTicks = parseInt(text, 10);
        }

        map.set(noteId, {
            type: "note",
            id: when.getAttribute("corresp") || noteId,
            onset: onsetTicks,
            offset: onsetTicks + durationTicks,
            onsetMs,
            offsetMs: onsetMs + durationMs,
            pitch: 0,
            velocity,
            channel: 0,
        });
    }

    return map;
}

const DEFAULT_STRETCH = 0.05;
const STRETCH_MULTIPLIER = 14.1;

export default function Viewer() {
    const [mei, setMEI] = useState<string>();
    const [spanMap, setSpanMap] = useState<Map<string, NoteSpan>>(new Map());
    const [duplicateNoteIDs, setDuplicateNoteIDs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();

    useEffect(() => {
        const load = async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.BASE_URL}transcription.mei`
                );
                if (!response.ok) {
                    setError("Failed to load transcription.mei");
                    setLoading(false);
                    return;
                }
                const text = await response.text();
                setMEI(text);

                setSpanMap(parseWhens(text));

                const { duplicateNoteIDs } = await getNotesFromMEI(text);
                setDuplicateNoteIDs(duplicateNoteIDs);
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const getSpanForNote = useCallback(
        (id: string) => spanMap.get(id),
        [spanMap]
    );

    const noop = useCallback(() => {}, []);

    if (loading) return <p>Loading score&hellip;</p>;
    if (error) return <p style={{ color: "red" }}>{error}</p>;

    return (
        <div className="viewer-mode" style={{ padding: "1rem" }}>
            <div style={{ width: "100vw", overflow: "scroll", position: "relative" }}>
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
