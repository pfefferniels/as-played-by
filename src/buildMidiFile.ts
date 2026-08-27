import type { MidiFile, AnyEvent } from "midifile-ts";
import type { RecordingInfo } from "./parseRecordings";

interface AbsoluteEvent {
    absTime: number;
    event: AnyEvent;
}

export function buildMidiFile(
    recording: RecordingInfo,
    pitchMap: Map<string, number>
): MidiFile {
    const events: AbsoluteEvent[] = [];

    // Tempo: 60 BPM = 1,000,000 µs/beat
    // With ticksPerBeat=1000, 1 tick = 1 ms
    events.push({
        absTime: 0,
        event: {
            deltaTime: 0,
            type: "meta",
            subtype: "setTempo",
            microsecondsPerBeat: 1000000,
        } as AnyEvent,
    });

    // Note events
    for (const [noteId, span] of recording.noteSpans) {
        const pitch = pitchMap.get(noteId);
        if (pitch === undefined) continue;

        // Text meta event carrying the note ID (for score following)
        events.push({
            absTime: span.onsetMs,
            event: {
                deltaTime: 0,
                type: "meta",
                subtype: "text",
                text: noteId,
            } as AnyEvent,
        });

        // NoteOn
        events.push({
            absTime: span.onsetMs,
            event: {
                deltaTime: 0,
                type: "channel",
                subtype: "noteOn",
                channel: 0,
                noteNumber: pitch,
                velocity: span.velocity,
            } as AnyEvent,
        });

        // NoteOff
        events.push({
            absTime: span.offsetMs,
            event: {
                deltaTime: 0,
                type: "channel",
                subtype: "noteOff",
                channel: 0,
                noteNumber: pitch,
                velocity: 0,
            } as AnyEvent,
        });
    }

    // Pedal events
    for (const pedal of recording.pedalEvents) {
        const cc = pedal.type === "sustain" ? 64 : 67;

        events.push({
            absTime: pedal.onsetMs,
            event: {
                deltaTime: 0,
                type: "channel",
                subtype: "controller",
                channel: 0,
                controllerType: cc,
                value: 127,
            } as AnyEvent,
        });

        events.push({
            absTime: pedal.onsetMs + pedal.durationMs,
            event: {
                deltaTime: 0,
                type: "channel",
                subtype: "controller",
                channel: 0,
                controllerType: cc,
                value: 0,
            } as AnyEvent,
        });
    }

    // End of track
    const maxTime = events.reduce((max, e) => Math.max(max, e.absTime), 0);
    events.push({
        absTime: maxTime + 1,
        event: {
            deltaTime: 0,
            type: "meta",
            subtype: "endOfTrack",
        } as AnyEvent,
    });

    // Sort by absolute time (stable sort preserves insertion order for ties)
    events.sort((a, b) => a.absTime - b.absTime);

    // Convert to delta times
    let prevTime = 0;
    for (const e of events) {
        e.event.deltaTime = e.absTime - prevTime;
        prevTime = e.absTime;
    }

    return {
        header: {
            formatType: 0,
            trackCount: 1,
            ticksPerBeat: 1000,
        },
        tracks: [events.map((e) => e.event)],
    };
}
