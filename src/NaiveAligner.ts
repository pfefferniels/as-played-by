import { loadVerovio } from "./loadVerovio.mts";
import { AnySpan } from "./MidiSpans";

export type ScoreNote = {
    onset: number; // in quarter notes
    duration: number; // in quarter notes
    pitch: number; // MIDI pitch
    note: string; // MEI note ID
}

export const getNotesFromMEI = async (mei: string): Promise<{ notes: ScoreNote[], duplicateNoteIDs: string[] }> => {
    // Create symbolic notes
    const meiDoc = new DOMParser().parseFromString(mei, 'text/xml');
    const vrvToolkit = await loadVerovio();
    vrvToolkit.setOptions({
        appXPathQuery: ["./rdg[contains(@source, 'performance')]"],
    });
    vrvToolkit.loadData(mei);
    vrvToolkit.renderToMIDI();

    const timemap = vrvToolkit.renderToTimemap()

    const duplicateNoteIDs: string[] = []
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
            return meiDoc.querySelector(`tie[endid="#${entry.note}"]`) === null
        })
        .map(entry => {
            const offset = timemap.find(e => e.off?.includes(entry.note))?.qstamp || entry.qstamp;
            const duration = offset - entry.qstamp;
            const { pitch } = vrvToolkit.getMIDIValuesForElement(entry.note);
            return {
                onset: entry.qstamp,
                duration,
                pitch,
                note: entry.note
            }
        })
        .filter((entry, index, arr) => {
            console.log('entry', entry)
            // Filter out duplicates based on onset and note
            const withoutDuplicate = arr.findIndex(e => e.onset === entry.onset && e.pitch === entry.pitch) === index
            if (!withoutDuplicate) {
                duplicateNoteIDs.push(entry.note);
            }
            return withoutDuplicate;
        })

    return { notes, duplicateNoteIDs };
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
            console.log(chordNotes.length, 'chord notes')
            for (const chordNote of chordNotes) {
                const corresp = tmpPerfNotes
                    .slice(0, chordNotes.length)
                    .find(n => n.pitch === chordNote.pitch)

                console.log('searching corresp for', chordNote, 'found', corresp)
                if (!corresp) {
                    return result
                }
                result.push({
                    score_id: chordNote.note,
                    performance_id: corresp.id
                })
                tmpPerfNotes.splice(tmpPerfNotes.indexOf(corresp), 1)
            }
        }
    }

    return result
}