import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
// Self-hosted instead of Google Fonts: no request leaves the machine, and the UI
// works offline. Only the weights the UI actually uses.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import './style.css'
import App from './App.tsx'
import {BrowserRouter} from 'react-router-dom'

document.documentElement.setAttribute('data-theme', 'light')
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App/>
        </ BrowserRouter>
    </StrictMode>,
)
