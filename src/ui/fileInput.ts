/**
 * Reading the file behind an <input type="file"> as a promise.
 *
 * Only the reading is shared. What counts as an acceptable file, and what is
 * shown when one is refused, differs between the views and stays with them:
 * the editor takes whatever it is given, while /mlign checks a file over before
 * it keeps it.
 */

const read = <T extends string | ArrayBuffer>(
    file: File,
    start: (reader: FileReader) => void
): Promise<T> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
            reject(new Error(`${file.name} could not be read from disk.`));
        reader.onload = () => resolve(reader.result as T);
        start(reader);
    });

/** The file as text, for an MEI document */
export const readAsText = (file: File): Promise<string> =>
    read<string>(file, reader => reader.readAsText(file));

/** The file as bytes, for a MIDI recording */
export const readAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
    read<ArrayBuffer>(file, reader => reader.readAsArrayBuffer(file));

/** The single file an <input type="file"> change event carries, if there is one */
export const chosenFile = (event: React.ChangeEvent<HTMLInputElement>): File | undefined =>
    event.target.files?.[0];
