import { MidiFile } from "midifile-ts";

export const insertMetadata = (midi: MidiFile, meiDoc: Document) => {
    const appInfo = meiDoc.querySelector("encodingDesc appInfo");
    if (!appInfo) {
        console.warn("No appInfo found in meiDoc");
        return;
    }

    let applicationName = ''
    let textContent = ''
    for (const track of midi.tracks) {
        for (let i=0; i<track.length; i++) {
            const event = track[i];

            if (event.type === 'meta' && event.subtype === 'text') {
                if (i === 0) {
                    applicationName = event.text
                }
                else {
                    textContent += event.text + ' ';
                }
            }
            else break
        }
    }

    const application = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "application");
    const name = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "name");
    application.appendChild(name)
    name.textContent = applicationName;

    const p = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "p");
    p.textContent = textContent
    application.appendChild(p);

    appInfo.appendChild(application);
}
