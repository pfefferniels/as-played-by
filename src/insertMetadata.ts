import { MidiFile } from "midifile-ts";

export const insertMetadata = (midi: MidiFile, meiDoc: Document) => {
    const appInfo = meiDoc.querySelector("encodingDesc appInfo");
    if (!appInfo) {
        console.warn("No appInfo found in meiDoc");
        return;
    }

    let applicationName = ''
    const list = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "list");
    for (const track of midi.tracks) {
        for (let i = 0; i < track.length; i++) {
            const event = track[i];

            if (event.type === 'meta' && event.subtype === 'text') {
                if (i === 0) {
                    applicationName = event.text
                }
                else {
                    const li = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "li");
                    li.textContent = event.text;
                    list.appendChild(li);
                }
            }
            else break
        }
    }

    const application = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "application");
    application.setAttribute("xml:id", "roll-emulation");
    const name = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "name");
    name.textContent = applicationName

    const p = meiDoc.createElementNS("http://www.music-encoding.org/ns/mei", "p");
    const text = meiDoc.createTextNode("Parameters:");
    p.appendChild(text);
    p.appendChild(list);

    application.appendChild(name)
    application.appendChild(p)

    appInfo.appendChild(application);
}
