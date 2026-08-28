import { loadVerovio } from "./verovio/toolkit";
import { applyNotatedOnsets } from "./notatedOnsets";
import { AnySpan } from "./MidiSpans";

/** Every tie of the document, by the note it ends on and by the note it starts from */
const readTies = (meiDoc: Document) => {
    const tieInto = new Map<string, Element>();
    const tiedOn = new Map<string, string>();

    for (const tie of meiDoc.querySelectorAll("tie")) {
        const from = tie.getAttribute("startid")?.replace(/^#/, "");
        const to = tie.getAttribute("endid")?.replace(/^#/, "");

        if (to) tieInto.set(to, tie);
        if (from && to) tiedOn.set(from, to);
    }

    return { tieInto, tiedOn };
};

/** The last note of the tie chain this note starts, i.e. the one released */
const lastOfTie = (id: string, tiedOn: Map<string, string>): string => {
    const seen = new Set([id]);

    let last = id;
    for (;;) {
        const next = tiedOn.get(last);
        if (!next || seen.has(next)) return last;

        seen.add(next);
        last = next;
    }
};

export type ScoreNote = {
    onset: number; // in quarter notes
    duration: number; // in quarter notes
    pitch: number; // MIDI pitch
    note: string; // MEI note ID
}

export type ScoreNoteOptions = {
    /**
     * Whether a pitch sounding twice at the same moment - a unison written in two
     * voices - is read as one note. An aligner that expects one score note per
     * performed note wants this; one that decides for itself which of the two was
     * not played wants both notes.
     */
    collapseUnisons?: boolean;

    /**
     * Whether notes are given the onset the score writes rather than the one
     * verovio would play them at. Verovio rolls an arpeggio and lets a grace note
     * take its time out of the note it leans on, which moves real notes away from
     * where they stand in the notation; see ./notatedOnsets.
     */
    notatedOnsets?: boolean;
}

/**
 * The notes of the score in the order they sound, as verovio reads them.
 *
 * Two things are always true of the result: a tied group counts as the single
 * note it sounds as, lasting until the end of the tie, and where the encoding
 * offers editorial readings the performance one is taken.
 */
export const getNotesFromMEI = async (
    mei: string,
    { collapseUnisons = true, notatedOnsets = false }: ScoreNoteOptions = {}
): Promise<ScoreNote[]> => {
    // Create symbolic notes
    const meiDoc = new DOMParser().parseFromString(mei, 'text/xml');
    const vrvToolkit = await loadVerovio();
    vrvToolkit.setOptions({
        appXPathQuery: ["./rdg[contains(@source, 'performance')]"],
    });
    vrvToolkit.loadData(mei);
    vrvToolkit.renderToMIDI();

    const timemap = vrvToolkit.renderToTimemap()

    // Asking the document and the timemap about one note at a time is a scan of
    // each per note; every question they are asked below is prepared here instead
    const { tieInto, tiedOn } = readTies(meiDoc);
    const releasedAt = new Map<string, number>();
    for (const entry of timemap) {
        for (const note of entry.off ?? []) {
            if (!releasedAt.has(note)) releasedAt.set(note, entry.qstamp);
        }
    }

    const notes = timemap
        .map(entry => {
            return (entry.on || []).map(note => {
                return {
                    qstamp: entry.qstamp,
                    note
                }
            })
        })
        .flat()
        .filter(entry => {
            const possibleTie = tieInto.get(entry.note);
            if (possibleTie) {
                if (possibleTie.closest('rdg')?.getAttribute('source') === 'original') {
                    return true;
                }
                return false;
            }
            return true;
        })
        .map(entry => {
            // A tie makes one sounding note out of the chain, and the row that
            // survives it is the one that starts it: it lasts until the last note
            // of the chain is released, not until its own written length is up
            const released = lastOfTie(entry.note, tiedOn);
            const offset = releasedAt.get(released) ?? entry.qstamp;
            const duration = offset - entry.qstamp;
            const { pitch } = vrvToolkit.getMIDIValuesForElement(entry.note);
            return {
                onset: entry.qstamp,
                duration,
                pitch,
                note: entry.note
            }
        })

    // Before the unisons are weighed up, so that notes an arpeggio had spread are
    // compared at the one onset the chord is written at
    if (notatedOnsets) applyNotatedOnsets(notes, meiDoc);

    if (!collapseUnisons) return notes;

    return notes.filter((entry, index, arr) =>
        arr.findIndex(e => e.onset === entry.onset && e.pitch === entry.pitch) === index)
}

export type Match = {
    score_id: string;
    performance_id: string;
}

export const naiveAligner = (
    scoreNotes: ScoreNote[],
    perfNotes: AnySpan[]
): Match[] => {
    const chords = Map.groupBy(scoreNotes, (note) => note.onset);

    const tmpPerfNotes = [...perfNotes]
        .filter(span => span.type === 'note')
        .sort((a, b) => a.onsetMs - b.onsetMs);
    const result: Match[] = []
    for (const [, chordNotes] of chords) {
        if (tmpPerfNotes.length === 0) {
            console.log('no more perf notes left')
            return result
        }

        if (chordNotes.length === 1) {
            console.log('single note')
            // only a single note? Should be the next performed note
            if (tmpPerfNotes[0].pitch === chordNotes[0].pitch) {
                result.push({
                    score_id: chordNotes[0].note,
                    performance_id: tmpPerfNotes[0].id
                })
                tmpPerfNotes.splice(0, 1)
            }
            else {
                console.log('but no corresp')
                // not? break off
                return result
            }
        }
        else {
            let alignedChordNotes = 0
            for (const chordNote of chordNotes) {
                const corresp = tmpPerfNotes
                    .slice(0, chordNotes.length)
                    .find(n => n.pitch === chordNote.pitch)

                if (!corresp) {
                    // if we are within a chord and something 
                    // could not be aligned, we consider the 
                    // whole chord to be unmatched
                    return result.slice(0, result.length - alignedChordNotes);
                }
                result.push({
                    score_id: chordNote.note,
                    performance_id: corresp.id
                })
                tmpPerfNotes.splice(tmpPerfNotes.indexOf(corresp), 1)
                alignedChordNotes += 1;
            }
        }
    }

    return result
}