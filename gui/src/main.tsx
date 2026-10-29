import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App'
import { createJcoTheme } from './theme'
import type { ThemePreference } from './theme'
import './styles.css'

const STORAGE_KEY = 'jco-theme-preference'

function initialPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* Local storage may be unavailable in isolated previews. */ }
  return 'system'
}

function JcoRoot() {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const theme = useMemo(() => createJcoTheme(mode), [mode])
  useEffect(() => {
    document.documentElement.dataset.jcoTheme = mode
    try { window.localStorage.setItem(STORAGE_KEY, preference) } catch { /* non-persistent preview */ }
  }, [mode, preference])

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
