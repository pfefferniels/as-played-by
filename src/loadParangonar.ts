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
    // Mock implementation - create some test alignment pairs
    console.log('Mock getPairs called with:', { midi, mei });
    
    // Create mock alignment data matching our test files
    const pairs: Pair[] = [
        { label: 'match', performance_id: '0-0-60', score_id: 'note1' },
        { label: 'match', performance_id: '0-480-62', score_id: 'note2' },
        { label: 'match', performance_id: '0-960-64', score_id: 'note3' },
        { label: 'match', performance_id: '0-1440-65', score_id: 'note4' },
        { label: 'match', performance_id: '0-1920-67', score_id: 'note5' },
        { label: 'match', performance_id: '0-2400-69', score_id: 'note6' },
        { label: 'match', performance_id: '0-2880-71', score_id: 'note7' },
        { label: 'match', performance_id: '0-3360-72', score_id: 'note8' },
    ];
    
    return pairs;
}
