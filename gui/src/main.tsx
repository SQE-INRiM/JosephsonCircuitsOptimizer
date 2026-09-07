import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App'
import { jcoTheme } from './theme'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={jcoTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
