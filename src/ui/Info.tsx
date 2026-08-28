import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText } from '@mui/material';

interface InfoDialogProps {
    open: boolean;
    onClose: () => void;
}

const InfoDialog: React.FC<InfoDialogProps> = ({ open, onClose }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Help</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <p>
                        This tool allows you to align an existing MEI file
                        with a performance encoded in MIDI and adapt
                        the MEI file to match the performance ("as played by").
                    </p>
                    <p>
                        Start by uploading both files. Then you can align 
                        them. You will see where they match and where they do not: 
                        insertions and deletions will be highlighted. You 
                        can click on the notes, which will take you directly 
                        to the corresponding place in the MEI file. You can
                        then edit it and re-align. Once everything is done, 
                        click on "insert whens" and then on "download" to 
                        obtain the "as-played-by" MEI encoding.
                    </p>
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
};

export default InfoDialog;