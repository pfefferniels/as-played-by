import type { MidiFile } from "midifile-ts";
import { asSpans } from "../performance/midiSpans";
import { insertMetadata, parseMetadata } from "../mei/insertMetadata";
import { insertPedals } from "../mei/insertPedals";
import { insertRecording, insertWhen } from "../mei/when";
import type { Match } from "./types";

/**
 * Write a matching of the score against a MIDI recording into the MEI, as the
 * <recording> of its <performance>.
 *
 * This is what the score is laid out from, so the editor renders the result of
 * this while aligning and only writes the very same document back when the
 * alignment is finalized.
 */
export function applyAlignment(
    mei: string,
    midi: MidiFile,
    pairs: Match[]
): string {
    const meiDoc = new DOMParser().parseFromString(mei, "application/xml");

    const metadata = parseMetadata(midi);
    insertMetadata(metadata, meiDoc);

    const recording = insertRecording(meiDoc, metadata?.source);
    if (!recording) {
        throw new Error("Could not create the <recording> element");
    }

    const spans = asSpans(midi, true);
    const unknown: string[] = [];

    for (const pair of pairs) {
        const span = spans.find((span) => span.id === pair.performance_id);
        if (!span) continue;

        // A <when> may only point at an element the document holds. Verovio hands
        // out ids of its own for material it unfolds - a repeated section is read
        // from ids like "n1-rend2" that exist nowhere in the source - and writing
        // those through would leave the MEI referring to nothing
        if (!meiDoc.querySelector(`[*|id="${pair.score_id}"]`)) {
            unknown.push(pair.score_id);
            continue;
        }

        insertWhen(meiDoc, recording, span, pair.score_id);
    }

    if (unknown.length > 0) {
        console.warn(
            `Left out ${unknown.length} match(es) against elements the MEI does not contain, such as '${unknown[0]}'`
        );
    }

    insertPedals(
        spans.filter((span) => span.type === "soft" || span.type === "sustain"),
        [],
        meiDoc,
        metadata?.source || ""
    );

    return new XMLSerializer().serializeToString(meiDoc);
}
