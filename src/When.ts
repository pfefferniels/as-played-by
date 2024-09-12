import { AnySpan } from "./MidiSpans";

export const removeAllWhen = (mei: Document) => {
  mei.querySelectorAll('when').forEach(when => when.remove());
};

export const removeAllPedals = (mei: Document) => {
  mei.querySelectorAll('pedal').forEach(pedal => pedal.remove());
}

export const insertWhen = (newMEI: Document, clickedMidiSpan: AnySpan, clickedScoreNote: string) => {
  let recording = newMEI.querySelector('recording');
  if (!recording) {
    console.log('no performance element found, creating one');
    recording = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'recording');
    const performance = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'performance');
    const music = newMEI.querySelector('music');
    if (!music) {
      console.log('No <music> element found. Aborting.');
      return;
    }
    music.appendChild(performance);
    performance.appendChild(recording);
  }

  const when = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'when');
  recording.appendChild(when);

  when.setAttribute('absolute', clickedMidiSpan.onsetMs.toFixed(0) + 'ms');
  when.setAttribute('abstype', 'smil');
  when.setAttribute('corresp', clickedMidiSpan.link || clickedMidiSpan.id);
  when.setAttribute('data', '#' + clickedScoreNote);

  if (clickedMidiSpan.type === 'note') {
    const velocity = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
    velocity.setAttribute('type', 'velocity');
    velocity.textContent = clickedMidiSpan.velocity.toString();
    when.appendChild(velocity);
  }

  const durationMs = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
  durationMs.setAttribute('type', 'duration');
  durationMs.textContent = (clickedMidiSpan.offsetMs - clickedMidiSpan.onsetMs).toFixed(0) + 'ms';

  const onsetTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
  onsetTicks.setAttribute('type', 'onsetTicks');
  onsetTicks.textContent = clickedMidiSpan.onset.toString();

  const durationTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData');
  durationTicks.setAttribute('type', 'durationTicks');
  durationTicks.textContent = (clickedMidiSpan.offset - clickedMidiSpan.onset).toString();

  when.appendChild(durationMs);
  when.appendChild(onsetTicks);
  when.appendChild(durationTicks);
};


