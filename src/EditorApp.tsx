import { Link } from "react-router-dom";
import { App } from "./App2";
import "./App.css";

// The piano lives in the provider main.tsx puts around the routes; a second one
// here would load the whole sample set a second time
export default function EditorApp() {
    return (
        <div className="editor-mode">
            <nav style={{ padding: "0.5rem" }}>
                <Link to="/">Back to Viewer</Link>
            </nav>
            <App />
        </div>
    );
}
