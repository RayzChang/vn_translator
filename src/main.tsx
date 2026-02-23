import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyDark, getStoredDark } from './lib/theme'
import './index.css'
import App from './App'

applyDark(getStoredDark())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
