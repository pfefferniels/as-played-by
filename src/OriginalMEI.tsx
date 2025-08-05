import { useState, useEffect, useLayoutEffect } from "react";
import { VerovioToolkit } from "verovio/esm";
import { loadVerovio } from "./loadVerovio.mts";

interface OriginalMEIProps {
    mei: string
    highlight?: string
    onClick: (id: string) => void
}

export const OriginalMEI = ({ mei, highlight, onClick }: OriginalMEIProps) => {
    const [vrvToolkit, setVrvToolkit] = useState<VerovioToolkit>();
    const [svg, setSVG] = useState('');

    useEffect(() => {
        loadVerovio().then(tk => setVrvToolkit(tk));
    }, []);

    useLayoutEffect(() => {
        const svg = document.querySelector('#scoreDiv svg');
        if (!svg) return

        if (highlight) {
            const el = svg.querySelector(`#${highlight}`)
            if (el) {
                el.setAttribute('fill', 'red')
            }
        }

        Array.from(svg.querySelectorAll('.note')).forEach(note => {
            const xmlId = note.getAttribute('id')
            if (!xmlId) return

            note.addEventListener('click', () => onClick(xmlId))
        })
    }, [svg, onClick, highlight])

    useEffect(() => {
        if (!vrvToolkit) return

        vrvToolkit.setOptions({
            breaks: 'smart',
            pageHeight: 60000,
            adjustPageHeight: true,
            svgViewBox: true
        });
        vrvToolkit.loadData(mei);
        setSVG(vrvToolkit.renderToSVG(1));
    }, [mei, vrvToolkit])

    return (
        <div 
            id='scoreDiv' 
            style={{ 
                width: '100%', 
                height: '390px', 
                overflow: 'auto',
                position: 'relative'
            }}
            dangerouslySetInnerHTML={{ __html: svg }} 
        />
    )
}

