import { useCallback, useRef, useState } from 'react';
import './App.css';
import { MidiFile, read } from 'midifile-ts';
import { MidiViewer } from './MidiViewer';
import { AnySpan, asSpans, NoteSpan, SoftSpan, SustainSpan } from "./MidiSpans";
import { AlignedMEI } from './AlignedMEI';
import { loadVerovio } from './loadVerovio.mts';
import { prepareScoreEvents, ScoreEvent } from './ScoreEvents';
import { PairQueue } from './PairQueue';
import { insertWhen, removeAllPedals, removeAllWhen } from './When';
import { usePiano } from 'react-pianosound';
import { insertPedals } from './insertPedals';

function App() {
  const { playSingleNote } = usePiano()
  const [mei, setMEI] = useState<Document>();
  const [midi, setMIDI] = useState<MidiFile>();

  const [currentScoreEvent, setCurrentScoreEvent] = useState<ScoreEvent>()
  const [currentMidiSpan, setCurrentMidiSpan] = useState<AnySpan>()

  const queue = useRef<PairQueue>(new PairQueue())
  const pedals = useRef<(SustainSpan | SoftSpan)[]>([])

  const [stretchFactor, setStretchFactor] = useState<number>(0.1);

  const proceedToNextPair = useCallback(() => {
    if (!mei) return

    if (currentMidiSpan && currentScoreEvent) {
      const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
      insertWhen(newMEI, currentMidiSpan, currentScoreEvent.id)
      setMEI(newMEI)
    }

    const nextPair = queue.current.nextPair
    if (!nextPair) {
      setCurrentMidiSpan(undefined)
      setCurrentScoreEvent(undefined)
      return
    }

    setCurrentScoreEvent(nextPair[0])
    setCurrentMidiSpan(nextPair[1])

    if (nextPair[1]?.type === 'note') {
      playSingleNote(nextPair[1].pitch, 100, 0.8)
      if (nextPair[0]?.pitch) {
        setTimeout(() => playSingleNote(nextPair[0].pitch || 0, 200, 0.4), 450)
      }
    }
  }, [mei, currentMidiSpan, currentScoreEvent, queue, playSingleNote])

  const handleMEI = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files.length) return;

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target || !e.target.result) return;

      const meiWithIds = e.target.result as string

      const newMEI = new DOMParser().parseFromString(meiWithIds, 'application/xml')
      setMEI(newMEI)

      const tk = await loadVerovio()
      tk.loadData(meiWithIds)

      queue.current.scoreEvents = prepareScoreEvents(newMEI, tk)
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
      const newMIDI = read(binaryData as ArrayBuffer)
      setMIDI(newMIDI);

      const allSpans = asSpans(newMIDI, true)
      queue.current.midiEvents = allSpans.filter(span => span.type === 'note')
      pedals.current = allSpans.filter(span => span.type === 'sustain' || span.type === 'soft')
    };

    reader.readAsArrayBuffer(file);
  };

  const handleStretchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStretchFactor(Number(event.target.value));
  };

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

  const clearPedals = () => {
    if (!mei) return
    const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
    removeAllPedals(newMEI)
    setMEI(newMEI)
  }

  const handleInsertPedals = () => {
    if (!mei) {
      console.log('Cannot insert pedals when there is no MEI yet')
      return
    }

    const newMEI = new DOMParser().parseFromString(new XMLSerializer().serializeToString(mei), 'application/xml')
    insertPedals(
      pedals.current,
      queue.current.alignedPairs.filter(p => p[1].type === 'note') as [ScoreEvent, NoteSpan][],
      newMEI
    )
    setMEI(newMEI)
  }

  const toSVG = ([a, b]: [number, number]) => [(a - 100) * stretchFactor, (110 - b) * 5] as [number, number]

  return (
    <>
      <div style={{ position: 'absolute', top: 10, right: 10, margin: 2 }}>
        {mei && mei.querySelectorAll('when').length} &lt;when&gt; elements processed
      </div>

      <div style={{ position: 'absolute', top: 10, left: 10, width: 'fit-content' }}>
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
        <button onClick={proceedToNextPair}>⇒ Proceed</button>
        <button onClick={() => queue.current.ignoreScoreEvent()}>Ignore Score Event</button>
        <button onClick={handleInsertPedals}>Insert Pedals</button>
        <button onClick={clearPedals}>Clear Pedals</button>
      </div>

      <div style={{ width: '90vw', overflow: 'scroll' }}>
        {midi && (
          <MidiViewer
            file={midi}
            height={390}
            toSVG={toSVG}
            highlight={currentMidiSpan}
          />)}
      </div>

      {mei && (
        <AlignedMEI
          mei={mei}
          highlight={currentScoreEvent}
          toSVG={toSVG}
        />)
      }

      <br />
      <br />
    </>
  );
}

export default App;
