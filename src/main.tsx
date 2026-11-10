import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/michroma/400.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'
import './styles/layout.css'
import './styles/components.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
