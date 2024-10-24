import React, { useEffect, useState } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { xml } from '@codemirror/lang-xml';
import { Button, Stack } from '@mui/material';
import { loadVerovio } from './loadVerovio.mts';
import { Download, Save } from '@mui/icons-material';

interface CodeEditorProps {
    mei: string;
    onSave: (newMEI: string) => void;
}

export const CodeEditor = React.forwardRef<ReactCodeMirrorRef, CodeEditorProps>(
    ({ mei, onSave }: CodeEditorProps, ref) => {
        const [text, setText] = useState(mei)

        useEffect(() => {
            setText(mei)
        }, [mei])

        const handleDownload = () => {
            if (!text) return;

            const blob = new Blob([text], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'as-played-by.mei';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const handleExpand = async () => {
            if (!text) return

            const meiDoc = new DOMParser().parseFromString(text, 'application/xml')
            const expansionIds = Array
                .from(meiDoc.querySelectorAll('expansion'))
                .filter(el => el.hasAttribute('xml:id'))
                .map(el => el.getAttribute('xml:id')!)

            if (expansionIds.length === 0) return

            const tk = await loadVerovio()
            tk.setOptions({ expand: expansionIds[0], preserveAnalyticalMarkup: true })
            tk.loadData(mei)
            setText(tk.getMEI())
        }

        const handleSave = async () => {
            if (!text) return

            const tk = await loadVerovio()
            tk.setOptions({ preserveAnalyticalMarkup: true })
            tk.loadData(text)
            onSave(tk.getMEI())
        }


        return (
            <>
                <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                        disabled={mei === text}
                        startIcon={<Save />}
                    >
                        Apply
                    </Button>

                    <Button variant='contained' disabled={text.length === 0} onClick={handleDownload} startIcon={<Download />}>
                        Download
                    </Button>

                    <Button variant="contained" onClick={handleExpand}>
                        Expand Repetitions
                    </Button>
                </Stack>

                <CodeMirror
                    value={text || ''}
                    onChange={text => setText(text)}
                    extensions={[xml()]}
                    lang='application/xml'
                    height="70vh"
                    width="48vw"
                    ref={ref}
                />
            </>
        )
    })