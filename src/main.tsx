import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App2'
import './index.css'
// import { PianoContextProvider } from 'react-pianosound'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <PianoContextProvider> */}
      <App />
    {/* </PianoContextProvider> */}
  </React.StrictMode>,
)
