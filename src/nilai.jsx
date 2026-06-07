import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NilaiApp from './NilaiApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NilaiApp />
  </StrictMode>,
)
