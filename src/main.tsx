import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PianoContextProvider } from 'react-pianosound'
import './index.css'

// eslint-disable-next-line react-refresh/only-export-components
const Viewer = React.lazy(() => import('./Viewer'))
// eslint-disable-next-line react-refresh/only-export-components
const EditorApp = React.lazy(() => import('./EditorApp'))
// eslint-disable-next-line react-refresh/only-export-components
const MLignApp = React.lazy(() => import('./MLignApp'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PianoContextProvider>
      <BrowserRouter>
        <Suspense fallback={<p>Loading&hellip;</p>}>
          <Routes>
            <Route path="/" element={<Viewer />} />
            <Route path="/editor" element={<EditorApp />} />
            <Route path="/mlign" element={<MLignApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </PianoContextProvider>
  </React.StrictMode>,
)
