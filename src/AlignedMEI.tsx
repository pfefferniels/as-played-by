'use client'

import { loadVerovio } from "./loadVerovio.mjs";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { VerovioToolkit } from 'verovio/esm'
import { AnySpan } from "./MidiSpans";
import { Aligner } from "./Aligner";

interface AlignedMEIProps {
  mei: string
  duplicateNoteIDs?: string[]
  getSpanForNote: (id: string) => AnySpan | undefined
  stretchX: number
  highlight?: string
  onClick: (svgNote: SVGElement) => void
  onHover: (svgNote: SVGElement) => void
}

export const AlignedMEI = ({ mei, duplicateNoteIDs, getSpanForNote, stretchX, onClick, onHover }: AlignedMEIProps) => {
  // const { playSingleNote } = usePiano()
  const [svg, setSVG] = useState<string>('');
  const [toolkit, setToolkit] = useState<VerovioToolkit>()

  const divRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!divRef.current) return

    const svg = divRef.current.querySelector('svg') as SVGSVGElement | null;
    if (!svg || !toolkit || svg.hasAttribute('data-modified')) return;

    const aligner = new Aligner(svg, getSpanForNote, stretchX);
    aligner.run(toolkit);

    svg.querySelectorAll('.note').forEach((svgNote) => {
      svgNote.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick(svgNote as SVGElement);
      });

      svgNote.addEventListener('mouseover', (e) => {
        e.stopPropagation();
        onHover(svgNote as SVGElement);
      });
    })

    if (duplicateNoteIDs) {
      for (const duplicate of duplicateNoteIDs) {
        const svgNote = svg.querySelector<SVGElement>(`.note[data-id="${duplicate}"]`);
        if (svgNote) {
          svgNote.style.display = 'none';
        }
      }
    }
  }, [divRef, toolkit, getSpanForNote, duplicateNoteIDs, stretchX, onClick, onHover]);

  useEffect(() => {
    loadVerovio().then((toolkit) => {
      toolkit.setOptions({
        adjustPageHeight: true,
        adjustPageWidth: true,
        scale: 70,
        header: 'none',
        breaks: 'none',
        svgAdditionalAttribute: ['tie@startid', 'tie@endid', 'measure@n', 'layer@n', 'note@corresp', 'note@pname', 'note@oct', 'note@accid', 'note@accid.ges'],
        appXPathQuery: ['./rdg[contains(@source, "performance")]'],
        svgHtml5: true
      });
      toolkit.loadData(mei);
      toolkit.renderToMIDI()
      setSVG(toolkit.renderToSVG(1));
      console.log('setting svg, should render')
      setToolkit(toolkit)
    })
  }, [mei, getSpanForNote, stretchX])

  return (
    <div
      id='scoreDiv'
      ref={divRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

