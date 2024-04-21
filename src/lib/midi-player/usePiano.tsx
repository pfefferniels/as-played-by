import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Piano } from "@tonejs/piano/build/piano/Piano";
import * as Tone from 'tone'
import { MidiFile } from 'midifile-ts';
import { asNotes } from '../../MidiNote';

interface PianoContextProps {
  piano: Piano;
}

const PianoContext = createContext<PianoContextProps | undefined>(undefined);

interface PianoContextProviderProps {
  children: ReactNode
}

export const PianoContextProvider = ({ children }: PianoContextProviderProps) => {
  const [piano] = useState(() => {
    const initializedPiano = new Piano({
      // release: true,
      velocities: 1,
    });

    initializedPiano.toDestination();

    (async () => {
      await initializedPiano.load();
    })();

    return initializedPiano;
  });

  useEffect(() => {
    return () => {
      // Clean up piano resources when the component unmounts
    };
  }, [piano]);

  return (
    <PianoContext.Provider value={{ piano }}>
      {children}
    </PianoContext.Provider>
  );
};

// Your MIDI event handling functions
export const usePiano = () => {
  const context = useContext(PianoContext);
  if (!context) {
    throw new Error('usePiano must be used within a PianoContextProvider');
  }
  const piano = context.piano

  const play = (file: MidiFile) => {
    const notes = asNotes(file)

    for (const note of notes) {
      Tone.Transport.schedule(() => {
        piano.keyDown({
          note: note.pitch.toString(),
          velocity: note.velocity, // scale to [0,1]
        });
      }, note.onsetMs / 1000);

      Tone.Transport.schedule(() => {
        piano.keyUp({
          note: note.pitch.toString()
        })
      }, note.offsetMs / 1000);
    }

    // TODO: pedal
    
    if (Tone.Transport.state === 'started') return
    Tone.start()
    Tone.Transport.start()
  };

  const stopAll = () => {
    // console.log('stop all')
    // Tone.Transport.stop()
    piano.stopAll()
  }

  const playSingleNote = (note: { hasPitch: number }) => {
    const mono = new Tone.MonoSynth().toDestination();
    mono.triggerAttackRelease(Tone.Midi(note.hasPitch).toNote(), "+0.5", "0");
  };

  return {
    play,
    playSingleNote,
    stop: stopAll,
    seconds: Tone.Transport.seconds,
    jumpTo: (seconds: number) => Tone.Transport.seconds = seconds
  };
};
