import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

// eslint-disable-next-line react-refresh/only-export-components
const Viewer = React.lazy(() => import('./Viewer'))
// eslint-disable-next-line react-refresh/only-export-components
const EditorApp = React.lazy(() => import('./EditorApp'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<p>Loading&hellip;</p>}>
        <Routes>
          <Route path="/" element={<Viewer />} />
          <Route path="/editor" element={<EditorApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
