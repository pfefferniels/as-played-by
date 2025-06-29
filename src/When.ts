import { AnySpan } from "./MidiSpans";

export const removeAllWhen = (mei: Document) => {
    mei.querySelectorAll('when').forEach(when => when.remove());
};

export const removeAllPedals = (mei: Document) => {
    mei.querySelectorAll('pedal').forEach(pedal => pedal.remove());
}

export const insertRecording = (newMEI: Document, source?: string) => {
    let recording = source
        ? newMEI.querySelector(`recording[source="${source}"]`)
        : newMEI.querySelector('recording');

    if (recording) {
        // remove the existing recording
        recording.remove()
    }

    recording = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'recording');
    let performance = newMEI.querySelector('performance');
    if (!performance) {
        performance = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'performance');

        const music = newMEI.querySelector('music');
        if (!music) {
            console.log('No <music> element found. Aborting.');
            return;
        }
        music.appendChild(performance);
    }
    performance.appendChild(recording);

    if (source && !recording.hasAttribute('source')) {
        recording.setAttribute('source', source);
    }

    return recording
}

export const insertWhen = (newMEI: Document, recording: Element, midiSpan: AnySpan, scoreNote: string) => {
    const when = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'when');
    recording.appendChild(when);

    when.setAttribute('absolute', midiSpan.onsetMs.toFixed(0) + 'ms');
    when.setAttribute('abstype', 'smil');
    when.setAttribute('corresp', midiSpan.link || midiSpan.id);
    when.setAttribute('data', '#' + scoreNote);

    if (midiSpan.type === 'note') {
        const velocity = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
        velocity.setAttribute('type', 'velocity');
        velocity.textContent = midiSpan.velocity.toString();
        when.appendChild(velocity);
    }

    const durationMs = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
    durationMs.setAttribute('type', 'duration');
    durationMs.textContent = (midiSpan.offsetMs - midiSpan.onsetMs).toFixed(0) + 'ms';

    const onsetTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
    onsetTicks.setAttribute('type', 'onsetTicks');
    onsetTicks.textContent = midiSpan.onset.toString();

    const durationTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
    durationTicks.setAttribute('type', 'durationTicks');
    durationTicks.textContent = (midiSpan.offset - midiSpan.onset).toString();

    when.appendChild(durationMs);
    when.appendChild(onsetTicks);
    when.appendChild(durationTicks);
};
