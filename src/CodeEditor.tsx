import React, { useEffect, useState } from 'react';
import CodeMirror, { EditorSelection, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { xml } from '@codemirror/lang-xml';
import { Button, Divider, Stack } from '@mui/material';
import { loadVerovio } from './loadVerovio.mts';
import { OpenInFull, Save } from '@mui/icons-material';
import { MenuItem } from '@mui/material';
import DropdownButton from './DropdownButton';
import { CreateReading } from './CreateReading';
import { AnySpan } from './MidiSpans';

interface CodeEditorProps {
    mei: string;
    onSave: (newMEI: string) => void;
    ref: React.RefObject<ReactCodeMirrorRef>;
    selectedSpans: AnySpan[];
}

export const CodeEditor = ({ mei, onSave, ref, selectedSpans }: CodeEditorProps) => {
    const [text, setText] = useState(mei)
    const [createReading, setCreateReading] = useState(false)

    useEffect(() => {
        setText(mei)
    }, [mei])

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

    let selectedBit = ''
    const view = ref?.current?.view
    if (view) {
        const { from, to } = view.state.selection.main
        selectedBit = view.state.doc.sliceString(from, to)
    }

    return (
        <div>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button
                    variant="contained"
                    color="primary"
                    size='small'
                    onClick={handleSave}
                    disabled={mei === text}
                    startIcon={<Save />}
                >
                    Apply
                </Button>

                <Button variant="outlined" size='small' onClick={handleExpand} startIcon={<OpenInFull />}>
                    Expand Repetitions
                </Button>

                {selectedSpans.length > 0 && (
                    <Button variant='outlined' size='small' onClick={() => {
                        const view = ref.current?.view
                        if (!view) return

                        const { head } = view.state.selection.main

                        for (const span of selectedSpans) {
                            if (span.type !== 'note') {
                                console.warn('Span types other than note are not supported', span);
                                return;
                            }
                            const pitch = span.pitch;
                            const chroma = ((pitch % 12) + 12) % 12;
                            const [pname, ...accArr] = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"][chroma];
                            const accid = accArr.join("");
                            const oct = Math.floor(pitch / 12) - 1;

                            const meiNote = `<note pname="${pname}" oct="${oct}" xml:id="${span.id}" stem.dir="up" accid="${accid}" />\n`;

                            view.dispatch({
                                changes: { from: head, insert: meiNote },
                                selection: EditorSelection.single(head + meiNote.length)
                            })
                        }
                        view.focus()
                    }}>
                        Insert {selectedSpans.length} notes
                    </Button>
                )}

                <DropdownButton name='Create Reading'>
                    <MenuItem onClick={() => setCreateReading(true)} disableRipple>
                        Performance
                    </MenuItem>
                    <MenuItem onClick={() => {
                        if (view) {
                            const { from, to } = view.state.selection.main;
                            const bit = view.state.doc.sliceString(from, to);
                            const wrapped = `<rdg source="original">\n    ${bit.trim()}\n</rdg>\n`;
                            view.dispatch({
                                changes: { from, to, insert: wrapped }
                            });
                            setText(view.state.doc.toString());
                        }
                    }} disableRipple>
                        Original
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => {
                        if (view) {
                            const { from, to } = view.state.selection.main;
                            const bit = view.state.doc.sliceString(from, to);
                            const wrapped = `\n<app>\n${bit.trim()}\n</app>\n`;
                            view.dispatch({
                                changes: { from, to, insert: wrapped }
                            });
                            setText(view.state.doc.toString());
                        }
                    }} disableRipple>
                        Enclose in &lt;app&gt;
                    </MenuItem>
                </DropdownButton>
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

            <CreateReading
                open={createReading}
                onClose={() => setCreateReading(false)}
                bit={selectedBit.trim()}
                onDone={(newMEI) => {
                    if (view) {
                        const { from, to } = view.state.selection.main;
                        view.dispatch({
                            changes: { from, to, insert: newMEI }
                        });
                        setText(view.state.doc.toString());
                    }
                    setCreateReading(false);
                }}
            />
        </div>
    )
}

