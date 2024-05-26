import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { MidiFile, read } from 'midifile-ts';
import { MidiViewer } from './MidiViewer';
import { MidiNote } from "./MidiNote";
import { AlignedMEI } from './AlignedMEI';
import { usePiano } from 'react-pianosound'
import { loadVerovio } from './loadVerovio.mts';
import { TimeMapEntry } from 'verovio';
import { VerovioToolkit } from 'verovio/esm';

const isEndOfTie = (mei: Document, noteId: string) => {
  return mei.querySelector(`tie[endid="#${noteId}"]`)
}

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
  when.setAttribute('corresp', clickedMidiNote.link || clickedMidiNote.id)
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
  const { playSingleNote } = usePiano()
  const [mei, setMEI] = useState<Document>();
  const [midi, setMIDI] = useState<MidiFile>();

  const [timemap, setTimemap] = useState<TimeMapEntry[]>([])
  const [vrvToolkit, setVrvToolkit] = useState<VerovioToolkit>()
  const [currentScoreNote, setCurrentScoreNote] = useState<string>()
  const [clickedMidiNote, setClickedMidiNote] = useState<MidiNote>()

  const [stretchFactor, setStretchFactor] = useState<number>(0.1);

  const alignAndUpdate = useCallback((scoreNote: string, midiNote: MidiNote) => {
    if (!midi || !mei) {
      console.log('Both, MIDI and MEI must be present for aligning')
      return
    }

    if (!scoreNote || !midiNote) return

    const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
    insertWhen(newMEI, midiNote, scoreNote)
    setMEI(newMEI)
  }, [mei, midi])

  const proceedToNextNote = useCallback(() => {
    if (!mei) return

    if (!timemap.length) {
      console.log('No timemap ready yet')
      return
    }

    let newNote
    if (!currentScoreNote) {
      newNote = timemap[0].on![0]
    }
    else {
      const orderedNoteIds = timemap
        .map(entry => entry.on)
        .flat()
        .filter(entry => entry !== undefined) as string[]

      console.log('current score note', currentScoreNote, 'in', orderedNoteIds)

      let currentIndex = orderedNoteIds.findIndex(id => id === currentScoreNote)
      if (currentIndex === -1 || currentIndex === orderedNoteIds.length - 1) {
        return
      }

      newNote = orderedNoteIds[currentIndex + 1]
      while (isEndOfTie(mei, newNote) && currentIndex < orderedNoteIds.length - 1) {
        currentIndex += 1
        newNote = orderedNoteIds[currentIndex + 1]
      }
    }

    setCurrentScoreNote(newNote)

    setTimeout(() => {
      document.querySelector(`#${newNote} use`)?.setAttribute('fill', 'red')

      if (!vrvToolkit) return
      if (!newNote) return

      const midiValues = vrvToolkit.getMIDIValuesForElement(newNote!)
      playSingleNote(midiValues.pitch, 800)
    }, 800)
  }, [mei, currentScoreNote, timemap, playSingleNote, vrvToolkit])

  const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) return;

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target || !e.target.result) return;

      //
      //tk.loadData(e.target.result as string)
      //const meiWithIds = tk.getMEI()
      const meiWithIds = e.target.result as string

      setMEI(new DOMParser().parseFromString(meiWithIds, 'application/xml'))

      const tk = await loadVerovio()
      tk.loadData(meiWithIds)
      const newTimemap = tk.renderToTimemap()
      tk.renderToMIDI()
      setTimemap(newTimemap)
      setVrvToolkit(tk)
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
    if (!clickedMidiNote || !currentScoreNote) return

    alignAndUpdate(currentScoreNote, clickedMidiNote)

    setClickedMidiNote(undefined)
    proceedToNextNote()
  }, [clickedMidiNote, currentScoreNote, alignAndUpdate, proceedToNextNote])


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

      <input type="range" min="0.01" max="0.2" step="0.01" value={stretchFactor} onChange={handleStretchChange} />
      <label>Adjust Horizontal Stretch: {stretchFactor.toFixed(2)}</label>
      <br />
      <button onClick={downloadMEI}>Download Aligned MEI</button>
      <button onClick={clear}>Clear</button>
      <button onClick={proceedToNextNote}>Proceed</button>

      <div style={{ width: '90vw', overflow: 'scroll' }}>
        {midi && (
          <MidiViewer
            file={midi}
            height={500}
            toSVG={toSVG}
            searchPitch={currentScoreNote && vrvToolkit?.getMIDIValuesForElement(currentScoreNote).pitch || undefined}
            onClick={(note: MidiNote) => {
              setClickedMidiNote(note)
            }}
            onHover={(note: MidiNote) => playSingleNote(note.pitch, 150, 0.15)}
          />)}
      </div>

      {mei && (
        <AlignedMEI
          mei={mei}
          onClick={(id) => setCurrentScoreNote(id)}
          toSVG={toSVG} />)}

      <br />
      <br />
    </>
  );
}

export default App;
