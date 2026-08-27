import { NoteSpan } from "./MidiSpans";

export interface PedalEvent {
    type: "sustain" | "soft";
    onsetMs: number;
    durationMs: number;
}

export interface RecordingInfo {
    source: string;
    label: string;
    noteSpans: Map<string, NoteSpan>;
    pedalEvents: PedalEvent[];
}

const PITCH_BASE: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

function getAccidentalOffset(noteEl: Element, ns: string): number {
    let accid = noteEl.getAttribute("accid");

    if (!accid) {
        const accidEl = noteEl.getElementsByTagNameNS(ns, "accid")[0];
        if (accidEl) {
            accid =
                accidEl.getAttribute("accid.ges") ||
                accidEl.getAttribute("accid");
        }
    }

    if (!accid) return 0;

    switch (accid) {
        case "f":
            return -1;
        case "s":
            return 1;
        case "ff":
            return -2;
        case "x":
        case "ss":
            return 2;
        case "n":
            return 0;
        default:
            return 0;
    }
}

export function parseRecordings(mei: string): {
    recordings: RecordingInfo[];
    pitchMap: Map<string, number>;
} {
    const doc = new DOMParser().parseFromString(mei, "application/xml");
    const ns = "http://www.music-encoding.org/ns/mei";

    // Build pitch map from score <note> elements
    const pitchMap = new Map<string, number>();
    for (const noteEl of doc.getElementsByTagNameNS(ns, "note")) {
        const id = noteEl.getAttribute("xml:id");
        const pname = noteEl.getAttribute("pname");
        const octAttr = noteEl.getAttribute("oct");
        if (!id || !pname || !octAttr) continue;

        const oct = parseInt(octAttr, 10);
        const base = PITCH_BASE[pname];
        if (base === undefined) continue;

        const accidOffset = getAccidentalOffset(noteEl, ns);
        pitchMap.set(id, (oct + 1) * 12 + base + accidOffset);
    }

    // Parse recordings
    const recordings: RecordingInfo[] = [];
    const recordingEls = doc.getElementsByTagNameNS(ns, "recording");

    for (let ri = 0; ri < recordingEls.length; ri++) {
        const recEl = recordingEls[ri];
        const source = recEl.getAttribute("source") || "";
        const label = `Recording ${ri + 1}`;

        const noteSpans = new Map<string, NoteSpan>();
        const pedalEvents: PedalEvent[] = [];

        for (const when of recEl.getElementsByTagNameNS(ns, "when")) {
            const absoluteAttr = when.getAttribute("absolute");
            if (!absoluteAttr) continue;
            const onsetMs = parseInt(absoluteAttr, 10);

            const dataAttr = when.getAttribute("data");
            const type = when.getAttribute("type");

            const extDatas = when.getElementsByTagNameNS(ns, "extData");
            let velocity = 64;
            let durationMs = 0;
            let onsetTicks = 0;
            let durationTicks = 0;

            for (let i = 0; i < extDatas.length; i++) {
                const ext = extDatas[i];
                const etype = ext.getAttribute("type");
                const text = ext.textContent || "";
                if (etype === "velocity") velocity = parseInt(text, 10);
                else if (etype === "duration") durationMs = parseInt(text, 10);
                else if (etype === "onsetTicks")
                    onsetTicks = parseInt(text, 10);
                else if (etype === "durationTicks")
                    durationTicks = parseInt(text, 10);
            }

            if (dataAttr) {
                const noteId = dataAttr.replace(/^#/, "");
                const corresp = when.getAttribute("corresp") || noteId;

                noteSpans.set(noteId, {
                    type: "note",
                    id: corresp,
                    onset: onsetTicks,
                    offset: onsetTicks + durationTicks,
                    onsetMs,
                    offsetMs: onsetMs + durationMs,
                    pitch: pitchMap.get(noteId) || 0,
                    velocity,
                    channel: 0,
                });
            } else if (type === "sustain" || type === "soft") {
                pedalEvents.push({ type, onsetMs, durationMs });
            }
        }

        recordings.push({ source, label, noteSpans, pedalEvents });
    }

    return { recordings, pitchMap };
}
