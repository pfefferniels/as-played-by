import { useEffect, useState } from 'react';
import './App.css';
import { MidiFile, read } from 'midifile-ts';
import { MidiViewer } from './MidiViewer';
import { MidiNote, asNotes } from "./MidiNote";
import { AlignedMEI } from './AlignedMEI';
import { align } from 'alignmenttool';
import { asNoteEvents } from './asNoteEvents';

const removeAllWhen = (mei: Document) => {
  mei.querySelectorAll('when').forEach(when => when.remove())
}

const insertWhen = (newMEI: Document, clickedMidiNote: MidiNote, clickedScoreNote: string) => {
  let recording = newMEI.querySelector('recording')
  if (!recording) {
    console.log('no performance element found, creating one')
    recording = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'recording')
    const performance = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'performance')
    const music = newMEI.querySelector('music')
    if (!music) {
      console.log('No <music> element found. Aborting.')
      return
    }
    music.appendChild(performance)
    performance.appendChild(recording)
  }

  const when = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'when')
  recording.appendChild(when)

  when.setAttribute('absolute', clickedMidiNote.onsetMs.toFixed(0) + 'ms')
  when.setAttribute('abstype', 'smil')
  when.setAttribute('corresp', clickedMidiNote.id)
  when.setAttribute('data', '#' + clickedScoreNote)

  const velocity = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData')
  velocity.setAttribute('type', 'velocity')
  velocity.textContent = clickedMidiNote.velocity.toString()

  const durationMs = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData')
  durationMs.setAttribute('type', 'duration')
  durationMs.textContent = (clickedMidiNote.offsetMs - clickedMidiNote.onsetMs).toFixed(0) + 'ms'

  const onsetTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData')
  onsetTicks.setAttribute('type', 'onsetTicks')
  onsetTicks.textContent = clickedMidiNote.onset.toString()

  const durationTicks = newMEI.createElementNS('http://www.music-encoding.org/ns/mei', 'extData')
  durationTicks.setAttribute('type', 'durationTicks')
  durationTicks.textContent = (clickedMidiNote.offset - clickedMidiNote.onset).toString()

  when.appendChild(durationMs)
  when.appendChild(velocity)
  when.appendChild(onsetTicks)
  when.appendChild(durationTicks)
}

function App() {
  const [mei, setMEI] = useState<Document>();
  const [midi, setMIDI] = useState<MidiFile>();

  const [clickedScoreNote, setClickedScoreNote] = useState<string>()
  const [clickedMidiNote, setClickedMidiNote] = useState<MidiNote>()

  const [stretchFactor, setStretchFactor] = useState<number>(0.1);

  const alignAll = async () => {
    if (!midi || !mei) {
      console.log('Both, MIDI and MEI must be present for aligning')
      return
    }

    const noteEvents = await asNoteEvents(mei)
    const midiEvents = asNotes(midi)

    const matches = await align(midiEvents.map((note) => {
      return {
        id: note.id,
        onset: note.onsetMs / 1000,
        offset: note.offsetMs / 1000,
        pitch: note.pitch,
        channel: note.channel,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }), noteEvents, 0.1, 4) as any

    const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
    for (let i = 0; i < matches.size(); i++) {
      const scoreId = matches.get(i).scoreId
      const midiId = matches.get(i).midiId

      const midiNote = midiEvents.find(event => event.id === midiId)
      if (!midiNote || scoreId === '*') {
        continue
      }

      insertWhen(newMEI, midiNote, scoreId)
    }
    setMEI(newMEI)
  }

  const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) return;

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target || !e.target.result) return;

      //const tk = await loadVerovio()
      //tk.loadData(e.target.result as string)
      //const meiWithIds = tk.getMEI()
      const meiWithIds = e.target.result as string

      setMEI(new DOMParser().parseFromString(meiWithIds, 'application/xml'))
    };
    reader.readAsText(file);
  };

  const handleMIDI = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) return;

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target) return;
      const binaryData = e.target.result;
      setMIDI(read(binaryData as ArrayBuffer));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleStretchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStretchFactor(Number(event.target.value));
  };

  useEffect(() => {
    if (!clickedMidiNote || !clickedScoreNote) return

    setMEI(mei => {
      if (!mei) return

      // TODO: this is dumb
      const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
      insertWhen(newMEI, clickedMidiNote, clickedScoreNote)
      return newMEI
    })

    setClickedMidiNote(undefined)
    setClickedScoreNote(undefined)
  }, [clickedMidiNote, clickedScoreNote])

  const downloadMEI = () => {
    if (!mei) return;

    const serializer = new XMLSerializer();
    const meiString = serializer.serializeToString(mei);
    const blob = new Blob([meiString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aligned.mei';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    if (!mei) return
    const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
    removeAllWhen(newMEI)
    setMEI(newMEI)
  }

  const toSVG = ([a, b]: [number, number]) => [(a - 100) * stretchFactor, (127 - b) * 5] as [number, number]

  return (
    <>
      <div style={{ position: 'absolute', top: 10, right: 10, margin: 2 }}>
        {mei && mei.querySelectorAll('when').length} &lt;when&gt; elements processed
      </div>

      <label htmlFor="mei-file">Upload MEI</label>
      <input type="file" id="mei-file" accept=".mei" onChange={handleMEI} />
      <br />

      <label htmlFor="midi-file">Upload MIDI</label>
      <input type="file" id="midi-file" accept=".midi,.mid" onChange={handleMIDI} />
      <br />

      <input type="range" min="0.05" max="0.2" step="0.01" value={stretchFactor} onChange={handleStretchChange} />
      <label>Adjust Horizontal Stretch: {stretchFactor.toFixed(2)}</label>
      <br />
      <button onClick={downloadMEI}>Download Aligned MEI</button>
      <button onClick={alignAll}>Align All</button>
      <button onClick={clear}>Clear</button>

      <div style={{ width: '90vw', overflow: 'scroll' }}>
        {midi && (
          <MidiViewer
            file={midi}
            height={500}
            toSVG={toSVG}
            onClick={(note: MidiNote) => {
              setClickedMidiNote(note)
            }}
          />)}
      </div>

      {mei && (
        <AlignedMEI
          mei={mei}
          onClick={(id) => setClickedScoreNote(id)}
          toSVG={toSVG} />)}

      <br />
      <br />
    </>
  );
}

export default App;
