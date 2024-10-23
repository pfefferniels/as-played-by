import { RefObject, useEffect, useState } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { xml } from '@codemirror/lang-xml';
import { Button } from '@mui/material';

interface CodeEditorProps {
    mei: string;
    onSave: (newMEI: string) => void;
    ref: RefObject<ReactCodeMirrorRef>
}

export const CodeEditor = ({
    mei,
    onSave,
    ref
}: CodeEditorProps) => {
    const [text, setText] = useState(mei)

    useEffect(() => {
        setText(mei)
    }, [mei])

    return (
        <>
            <Button
                variant="contained"
                color="primary"
                onClick={() => onSave(text)}
                disabled={mei === text}
                sx={{ mb: 1 }}
            >
                Save
            </Button>

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
};