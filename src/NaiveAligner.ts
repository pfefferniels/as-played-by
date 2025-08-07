import { Pair } from "./loadParangonar";
import { loadVerovio } from "./loadVerovio.mts";
import { AnySpan } from "./MidiSpans";

export type ScoreNote = {
    onset: number; // in quarter notes
    duration: number; // in quarter notes
    pitch: number; // MIDI pitch
    note: string; // MEI note ID
}

export const getNotesFromMEI = async (mei: string): Promise<ScoreNote[]> => {
    // Create symbolic notes
    const meiDoc = new DOMParser().parseFromString(mei, 'text/xml');
    const vrvToolkit = await loadVerovio();
    vrvToolkit.setOptions({
        appXPathQuery: ["./rdg[contains(@source, 'performance')]"],
    });
    vrvToolkit.loadData(mei);
    vrvToolkit.renderToMIDI();

    const timemap = vrvToolkit.renderToTimemap()

    return timemap
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
            // Filter out duplicates based on onset and note
            return arr.findIndex(e => e.onset === entry.onset && e.pitch === entry.pitch) === index;
        })
}

export const naiveAligner = (
    scoreNotes: ScoreNote[],
    perfNotes: AnySpan[]
): Pair[] => {
    const chords = Map.groupBy(scoreNotes, (note) => note.onset);

    const tmpPerfNotes = [...perfNotes]
        .filter(span => span.type === 'note')
        .sort((a, b) => a.onsetMs - b.onsetMs);
    const result: Pair[] = []
    for (const [, chordNotes] of chords) {
        if (tmpPerfNotes.length === 0) {
            console.log('no more perf notes left')
            return [
                ...result,
                ...scoreNotes
                    .slice(scoreNotes.indexOf(chordNotes[0]))
                    .map(note => {
                        return {
                            label: 'deletion' as const,
                            score_id: note.note
                        }
                    })
            ]
        }

        if (chordNotes.length === 1) {
            console.log('single note')
            // only a single note? Should be the next performed note
            if (tmpPerfNotes[0].pitch === chordNotes[0].pitch) {
                result.push({
                    label: 'match',
                    score_id: chordNotes[0].note,
                    performance_id: tmpPerfNotes[0].id
                })
                tmpPerfNotes.splice(0, 1)
            }
            else {
                console.log('but no corresp')
                // not? break off
                return [
                    ...result,
                    ...scoreNotes
                        .slice(scoreNotes.indexOf(scoreNotes[0]))
                        .map(note => {
                            return {
                                label: 'deletion' as const,
                                score_id: note.note
                            }
                        }),
                    ...tmpPerfNotes.map(span => {
                        return {
                            label: 'insertion' as const,
                            performance_id: span.id
                        }
                    })
                ]
            }
        }
        else {
            console.log(chordNotes.length, 'chord notes')
            for (const chordNote of chordNotes) {
                const corresp = tmpPerfNotes.find(n => n.pitch === chordNote.pitch)
                console.log('searching corresp for', chordNote, 'found', corresp)
                if (!corresp) {
                    return [
                        ...result,
                        ...scoreNotes
                            .slice(scoreNotes.indexOf(chordNote))
                            .map(note => {
                                return {
                                    label: 'deletion' as const,
                                    score_id: note.note
                                }
                            }),
                        ...tmpPerfNotes.map(span => {
                            return {
                                label: 'insertion' as const,
                                performance_id: span.id
                            }
                        })
                    ]
                }
                result.push({
                    label: 'match',
                    score_id: chordNote.note,
                    performance_id: corresp.id
                })
                tmpPerfNotes.splice(tmpPerfNotes.indexOf(corresp), 1)
            }
        }
    }

    return result
}