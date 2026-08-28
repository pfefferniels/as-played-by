import type { AnySpan } from "../performance/midiSpans";
import type { ScoreNote } from "../score/scoreNotes";
import type { Match } from "./types";

/**
 * Match the score against a performance by reading both from the beginning at
 * once, one written chord at a time.
 *
 * It assumes the performance follows the score note for note, and stops at the
 * first place it does not: this is the fallback for when the model in ./mlign is
 * not wanted, and an editor is expected to carry on by hand from where it broke off.
 */
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
            return result
        }

        if (chordNotes.length === 1) {
            // only a single note? Should be the next performed note
            if (tmpPerfNotes[0].pitch === chordNotes[0].pitch) {
                result.push({
                    score_id: chordNotes[0].note,
                    performance_id: tmpPerfNotes[0].id
                })
                tmpPerfNotes.splice(0, 1)
            }
            else {
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
