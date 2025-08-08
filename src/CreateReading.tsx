import { Dialog, DialogTitle, DialogContent, Stack, TextField, MenuItem, DialogActions, Button } from "@mui/material";
import { useState } from "react";

interface CreateReadingProps {
    open: boolean;
    bit: string;
    onClose: () => void;
    onDone: (replaceWith: string) => void;
}

const certaintyTypes = ['high', 'medium', 'low', 'unknown'] as const;
type Certainty = typeof certaintyTypes[number];

const readingTypes = [
    'added-octave',
    'fuller-chord',
    'ornamentation',
    'simplification',
    'rythmic-alteration',
    'unknown'
] as const;
type ReadingType = typeof readingTypes[number];

export const CreateReading = ({ open, bit, onDone, onClose }: CreateReadingProps) => {
    const [note, setNote] = useState('');
    const [certainty, setCertainty] = useState<Certainty>('unknown');
    const [readingType, setReadingType] = useState<ReadingType>('unknown');
    const [person, setPerson] = useState('');

    const handleSave = () => {
        onDone(`
<rdg source="performance" reason="${readingType}">
    <supplied resp="${person}" certainty="${certainty}">
        <annot>${note}</annot>
        ${bit}
    </supplied>
</rdg>
        `);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
        >
            <DialogTitle>Create Reading</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 2 }}>
                    <TextField
                        select
                        label="Type of reading"
                        fullWidth
                        value={readingType}
                        onChange={e => setReadingType(e.target.value as ReadingType)}
                    >
                        {readingTypes.map(option => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="Certainty"
                        fullWidth
                        value={certainty}
                        onChange={e => setCertainty(e.target.value as Certainty)}
                    >
                        {certaintyTypes.map(option => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label="Person responsible"
                        fullWidth
                        value={person}
                        onChange={e => setPerson(e.target.value)}
                    />

                    <TextField
                        label="Note on the transcription (e.g. how rhythmic alterations were interpreted)"
                        fullWidth
                        multiline
                        rows={3}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Cancel
                </Button>
                <Button onClick={handleSave} color="primary" variant="contained">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}

