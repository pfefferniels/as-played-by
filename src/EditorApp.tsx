import { Link } from "react-router-dom";
import { PianoContextProvider } from "react-pianosound";
import { App } from "./App2";
import "./App.css";

export default function EditorApp() {
    return (
        <PianoContextProvider>
            <div className="editor-mode">
                <nav style={{ padding: "0.5rem" }}>
                    <Link to="/">Back to Viewer</Link>
                </nav>
                <App />
            </div>
        </PianoContextProvider>
    );
}
