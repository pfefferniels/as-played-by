import { MidiFile } from "midifile-ts";

export function midiTickToMilliseconds(ticks: number, microsecondsPerBeat: number, ppq: number): number {
    // Calculate how many beats the given number of ticks represent
    const beats = ticks / ppq;

    // Convert beats to milliseconds
    const milliseconds = (beats * microsecondsPerBeat) / 1000;

    return milliseconds;
}

export interface MidiNote {
    id: string;
    pitch: number;
    onset: number;
    offset: number;
    velocity: number;
    channel: number;

    onsetMs: number;
    offsetMs: number;

    link?: string
}

export const asNotes = (file: MidiFile, readLinks = false) => {
    type Tempo = { atTick: number; microsecondsPerBeat: number; };
    const tempoMap: Tempo[] = [];
    const newNotes = [];
    const currentNotes: MidiNote[] = [];
    let bufferedMetaText
    for (let i = 0; i < file.tracks.length; i++) {
        const track = file.tracks[i];
        let currentTime = 0;
        for (const event of track) {
            currentTime += event.deltaTime;
            if (event.type === 'meta' && event.subtype === 'setTempo') {
                // console.log('set tempo to', event.microsecondsPerBeat)
                tempoMap.push({
                    atTick: currentTime,
                    microsecondsPerBeat: event.microsecondsPerBeat
                });
            }
            if (readLinks && event.type === 'meta' && event.subtype === 'text') {
                bufferedMetaText = event.text
            }
            else if (event.type === 'channel' && event.subtype === 'noteOn') {
                const currentTempo = tempoMap.slice().reverse().find(tempo => tempo.atTick <= currentTime);
                if (!currentTempo) {
                    console.log('No tempo event found. Skipping');
                    continue;
                }
                currentNotes.push({
                    id: `${i}-${currentTime}-${event.noteNumber}`,
                    onset: currentTime,
                    offset: 0,
                    velocity: event.velocity,
                    pitch: event.noteNumber,
                    channel: i,
                    onsetMs: midiTickToMilliseconds(currentTime, currentTempo.microsecondsPerBeat, file.header.ticksPerBeat),
                    offsetMs: 0,
                    link: bufferedMetaText
                });
                bufferedMetaText = undefined
            }
            else if (event.type === 'channel' && event.subtype === 'noteOff') {
                const currentTempo = tempoMap.slice().reverse().find(tempo => tempo.atTick <= currentTime);
                if (!currentTempo) {
                    console.log('No tempo event found. Skipping');
                    continue;
                }
                const currentNote = currentNotes.find(note => note.pitch === event.noteNumber);
                if (!currentNote) {
                    console.log('Found a note-off event without a previous note-on.');
                    continue;
                }
                currentNote.offset = currentTime;
                currentNote.offsetMs = midiTickToMilliseconds(currentTime, currentTempo.microsecondsPerBeat, file.header.ticksPerBeat),
                    newNotes.push(currentNote);
                currentNotes.splice(currentNotes.indexOf(currentNote), 1);
            }
        }
    }

    return newNotes.sort((a,b) => a.onset - b.onset);
};
