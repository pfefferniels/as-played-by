import { MidiFile, AnyEvent, MIDIControlEvents, NoteOnEvent, NoteOffEvent } from "midifile-ts";

function midiTickToMilliseconds(ticks: number, microsecondsPerBeat: number, ppq: number): number {
    const beats = ticks / ppq;
    return (beats * microsecondsPerBeat) / 1000;
}

interface Span<T extends string> {
    type: T
    id: string
    onset: number
    offset: number

    onsetMs: number
    offsetMs: number

    link?: string
}

export interface NoteSpan extends Span<'note'> {
    pitch: number;
    velocity: number;
    channel: number;
}

export interface SustainSpan extends Span<'sustain'> { }
export interface SoftSpan extends Span<'soft'> { }

export type AnySpan = NoteSpan | SustainSpan | SoftSpan

const isNoteOn  = (e: AnyEvent): e is NoteOnEvent  => e.type === 'channel' && e.subtype === 'noteOn';
const isNoteOff = (e: AnyEvent): e is NoteOffEvent => e.type === 'channel' && e.subtype === 'noteOff';

const sustainIsOn = (value: number) => value >= 64; // clearer boundary
const softIsOn    = (value: number) => value >= 64;

type SustainOpen = Record<number, SustainSpan | undefined>; // by MIDI channel 0..15
type SoftOpen    = Record<number, SoftSpan | undefined>;
type NoteOpen    = Record<string, NoteSpan | undefined>;    // key = `${channel}:${pitch}`

export const asSpans = (file: MidiFile, readLinks = false) => {
  const resultingSpans: AnySpan[] = [];

  type Tempo = { atTick: number; microsecondsPerBeat: number; };
  const tempoMap: Tempo[] = [];
  let bufferedMetaText: string | undefined;

  // per-track iteration is fine, but don't confuse track index with MIDI channel
  for (let i = 0; i < file.tracks.length; i++) {
    const track = file.tracks[i];
    let currentTime = 0;

    // per-track open maps (you could hoist to overall file scope if preferred)
    const sustainOpen: SustainOpen = {};
    const softOpen: SoftOpen = {};
    const noteOpen: NoteOpen = {};

    for (const event of track) {
      currentTime += event.deltaTime;

      if (event.type === 'meta' && event.subtype === 'setTempo') {
        tempoMap.push({ atTick: currentTime, microsecondsPerBeat: event.microsecondsPerBeat });
        continue;
      }

      if (readLinks && event.type === 'meta' && event.subtype === 'text') {
        bufferedMetaText = event.text;
        continue;
      }

      // we need a tempo before we can timestamp anything
      const currentTempo = tempoMap.slice().reverse().find(t => t.atTick <= currentTime);
      if (!currentTempo) continue;

      const onsetMs  = (ticks: number) => midiTickToMilliseconds(ticks, currentTempo.microsecondsPerBeat, file.header.ticksPerBeat);
      const offsetMs = onsetMs;

      if (event.type !== 'channel') continue; // we only handle channel events below

      const ch = event.channel

      // ========= NOTES =========
      if (isNoteOn(event)) {
        const key = `${ch}:${event.noteNumber}`;
        // if a duplicate note-on arrives without off, close-and-emit or ignore; here we ignore duplicates
        if (!noteOpen[key]) {
          noteOpen[key] = {
            type: 'note',
            id: `${i}-${currentTime}-note-${ch}-${event.noteNumber}`,
            onset: currentTime,
            offset: 0,
            onsetMs: onsetMs(currentTime),
            offsetMs: 0,
            pitch: event.noteNumber,
            velocity: event.velocity,
            channel: ch,
            link: bufferedMetaText
          };
        }
        bufferedMetaText = undefined;
        continue;
      }

      if (isNoteOff(event)) {
        const key = `${ch}:${event.noteNumber}`;
        const span = noteOpen[key];
        if (span) {
          span.offset = currentTime;
          span.offsetMs = offsetMs(currentTime);
          if (bufferedMetaText && span.link) span.link += ` ${bufferedMetaText}`;
          resultingSpans.push(span);
          noteOpen[key] = undefined;
        }
        bufferedMetaText = undefined;
        continue;
      }

      // ========= SUSTAIN (CC64) =========
      if (event.subtype === 'controller' && event.controllerType === MIDIControlEvents.SUSTAIN) {
        const on = sustainIsOn(event.value);
        if (on) {
          // only start if not already down on this channel
          if (!sustainOpen[ch]) {
            sustainOpen[ch] = {
              type: 'sustain',
              id: `${i}-${currentTime}-sustain-${ch}`,
              onset: currentTime,
              offset: 0,
              onsetMs: onsetMs(currentTime),
              offsetMs: 0,
              link: bufferedMetaText
            };
          }
        } else {
          // only end if currently down
          const span = sustainOpen[ch];
          if (span) {
            span.offset = currentTime;
            span.offsetMs = offsetMs(currentTime);
            if (bufferedMetaText && span.link) span.link += ` ${bufferedMetaText}`;
            resultingSpans.push(span);
            sustainOpen[ch] = undefined;
          }
        }
        bufferedMetaText = undefined;
        continue;
      }

      // ========= SOFT PEDAL (CC67) =========
      if (event.subtype === 'controller' && event.controllerType === MIDIControlEvents.SOFT_PEDAL) {
        const on = softIsOn(event.value);
        if (on) {
          if (!softOpen[ch]) {
            softOpen[ch] = {
              type: 'soft',
              id: `${i}-${currentTime}-soft-${ch}`,
              onset: currentTime,
              offset: 0,
              onsetMs: onsetMs(currentTime),
              offsetMs: 0,
              link: bufferedMetaText
            };
          }
        } else {
          const span = softOpen[ch];
          if (span) {
            span.offset = currentTime;
            span.offsetMs = offsetMs(currentTime);
            if (bufferedMetaText && span.link) span.link += ` ${bufferedMetaText}`;
            resultingSpans.push(span);
            softOpen[ch] = undefined;
          }
        }
        bufferedMetaText = undefined;
        continue;
      }
    }
  }

  return resultingSpans.sort((a, b) => a.onset - b.onset);
};



