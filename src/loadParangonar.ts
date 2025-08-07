import { MidiFile } from "midifile-ts";
import { midiSpansForParangonar } from "./MidiSpans";
import { loadVerovio } from "./loadVerovio.mts";

// Load the Parangonar WASM module
export async function loadParangonarModule() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingModule = (window as any).ParangonarModule;
    if (existingModule) {
        const Module = await new Promise((resolve, reject) => {
            // Module should be available as global ParangonarModule
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const P = (window as any).ParangonarModule;
            if (typeof P !== 'undefined') {
                const moduleConfig = {
                    onRuntimeInitialized: function () {
                        resolve(this);
                    }
                };
                P(moduleConfig);
            } else {
                reject(new Error('ParangonarModule not found after loading script'));
            }
        });
        return Module;
    }

    // Load the module using script tag since it uses UMD pattern
    const script = document.createElement('script');
    script.src = './parangonar.js';

    const Module = await new Promise((resolve, reject) => {
        script.onload = () => {
            // Module should be available as global ParangonarModule
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const P = (window as any).ParangonarModule;
            if (typeof P !== 'undefined') {
                const moduleConfig = {
                    onRuntimeInitialized: function () {
                        resolve(this);
                    }
                };
                P(moduleConfig);
            } else {
                reject(new Error('ParangonarModule not found after loading script'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load parangonar.js'));

        document.head.appendChild(script);
    });

    return Module
}

export type Pair =
    {
        label: 'match'
        performance_id: string
        score_id: string
    } |
    {
        label: 'insertion'
        performance_id: string
    } |
    {
        label: 'deletion'
        score_id: string
    }

export const getPairs = async (midi: MidiFile, mei: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parangonarModule: any = await loadParangonarModule()
    if (!parangonarModule) return

    // create perfomance notes
    const perfNotes = new parangonarModule.NoteArray();
    const spans = midiSpansForParangonar(midi)
    for (const { onsetSec, durationSec, pitch, velocity, id } of spans) {
        const perfNote = parangonarModule.createPerformanceNote(
            onsetSec, durationSec, pitch, velocity, id
        )

        perfNotes.push_back(perfNote);
    }

    // Create symbolic notes
    const scoreNotes = new parangonarModule.NoteArray();
    const meiDoc = new DOMParser().parseFromString(mei, 'text/xml');
    const vrvToolkit = await loadVerovio();
    vrvToolkit.setOptions({
        appXPathQuery: ["./rdg[contains(@source, 'performance')]"],
    });
    vrvToolkit.loadData(mei);
    vrvToolkit.renderToMIDI();

    const timemap = vrvToolkit.renderToTimemap()

    timemap
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
        .map(({ onset, duration, pitch, note}) => {
            return parangonarModule.createScoreNote(
                onset,
                duration,
                pitch,
                note
            )
        })
        .forEach((scoreNote) => {
            scoreNotes.push_back(scoreNote)
        })

    // Configure alignment
    const config = new parangonarModule.AutomaticNoteMatcherConfig();
    config.sfuzziness = 0.1;
    config.pfuzziness = 0.5;
    config.alignment_type = "greedy"


    // Perform alignment
    const alignment = parangonarModule.align(scoreNotes, perfNotes, config);

    // Process results
    const pairs: Pair[] = [];
    for (let i = 0; i < alignment.size(); i++) {
        const align = alignment.get(i);
        const label = align.label === parangonarModule.AlignmentLabel.MATCH
            ? 'match'
            : align.label === parangonarModule.AlignmentLabel.INSERTION
                ? 'insertion'
                : 'deletion'
        pairs.push({
            label,
            score_id: align.score_id,
            performance_id: align.performance_id
        })
    }

    return pairs
}
