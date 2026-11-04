import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App'
import { createJcoTheme, readStoredThemePreference } from './theme'
import type { ThemePreference } from './theme'
import './styles.css'

const STORAGE_KEY = 'jco-theme-preference'

function initialPreference(): ThemePreference {
  try {
    return readStoredThemePreference(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Local storage may be unavailable in isolated previews.
    return 'dark'
  }
}

function JcoRoot() {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference)
  const theme = useMemo(() => createJcoTheme(preference), [preference])

  useEffect(() => {
    document.documentElement.dataset.jcoTheme = preference
    try { window.localStorage.setItem(STORAGE_KEY, preference) } catch { /* non-persistent preview */ }
  }, [preference])

  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <App themePreference={preference} onThemePreferenceChange={setPreference} />
  </ThemeProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JcoRoot />
  </StrictMode>,
)
