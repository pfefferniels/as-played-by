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
    // Mock implementation - return empty pairs for now
    console.log('Mock getPairs called with:', { midi, mei });
    return [];
}
