'use client'

import { loadVerovio } from "./loadVerovio.mjs";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { VerovioToolkit } from 'verovio/esm'
import { AnySpan } from "./MidiSpans";
import { Aligner } from "./Aligner";


interface AlignedMEIProps {
  mei: string
  getSpanForNote: (id: string) => AnySpan | 'deletion' | undefined
  stretchX: number
  highlight?: string
  onClick: (svgNote: SVGElement) => void
}

export const AlignedMEI = ({ mei, getSpanForNote, stretchX, onClick }: AlignedMEIProps) => {
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
    })
  }, [divRef, toolkit, getSpanForNote, stretchX, onClick]);

  useEffect(() => {
    loadVerovio().then((toolkit) => {
      toolkit.setOptions({
        adjustPageHeight: true,
        adjustPageWidth: true,
        scale: 70,
        header: 'none',
        breaks: 'none',
        svgAdditionalAttribute: ['tie@startid', 'tie@endid', 'measure@n', 'layer@n', 'note@corresp'],
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

