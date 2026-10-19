import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { avviaCatturaInstallazione } from './lib/installa.js'

// Prima del render: l'evento di installazione (Android) arriva presto e
// non si ripete, va catturato subito.
avviaCatturaInstallazione()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
