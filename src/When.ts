import { AnySpan } from "./MidiSpans";

export const removeAllWhen = (mei: Document) => {
  mei.querySelectorAll('when').forEach(when => when.remove());
};

export const removeAllPedals = (mei: Document) => {
  mei.querySelectorAll('pedal').forEach(pedal => pedal.remove());
}

export const insertWhen = (newMEI: Document, midiSpan: AnySpan, scoreNote: string) => {
  let recording = newMEI.querySelector('recording');
  if (!recording) {
    console.log('no recording element found, creating one');
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

  for (const when of recording.querySelectorAll('when')) {
    if (when.getAttribute('absolute') === (midiSpan.onsetMs.toFixed(0) + 'ms') &&
      midiSpan.type === 'note' &&
      when.querySelector('extData[type="velocity"]')?.textContent === midiSpan.velocity.toString()
    ) {
      let corresp = when.getAttribute('corresp');
      if (!corresp) break;
      corresp += ' ' + midiSpan.link || midiSpan.id;
      when.setAttribute('corresp', corresp);
      return
    }
  }

  const when = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'when');
  recording.appendChild(when);

  when.setAttribute('absolute', midiSpan.onsetMs.toFixed(0) + 'ms');
  when.setAttribute('abstype', 'smil');
  console.log('midi span', midiSpan);
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


