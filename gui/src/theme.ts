import { createTheme } from '@mui/material/styles'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ThemeMode = 'light' | 'dark'

export function createJcoTheme(mode: ThemeMode) {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: dark
        ? { main: '#7bb4e1', dark: '#538fbd', light: '#263e55' }
        : { main: '#173a63', dark: '#102b4a', light: '#e8f0f8' },
      secondary: dark
        ? { main: '#e4ae61', dark: '#b88035', light: '#493722' }
        : { main: '#c7892f', dark: '#8f5f1e', light: '#fff3dc' },
      success: { main: dark ? '#70c8a9' : '#2d7d64' },
      warning: { main: dark ? '#e8b56a' : '#b06b1c' },
      error: { main: dark ? '#ee8181' : '#b74646' },
      background: dark
        ? { default: '#131d2a', paper: '#202d3c' }
        : { default: '#f4f6f8', paper: '#ffffff' },
      text: dark
        ? { primary: '#ecf3f8', secondary: '#aebed0' }
        : { primary: '#172231', secondary: '#607080' },
      divider: dark ? '#3b4b5d' : '#dce2e8',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, Segoe UI, system-ui, -apple-system, sans-serif',
      h4: { fontWeight: 760, letterSpacing: '-0.025em' },
      h5: { fontWeight: 730, letterSpacing: '-0.018em' },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 650 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiChip: { styleOverrides: { root: { fontWeight: 650 } } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: dark ? '#cad8e5' : '#607080',
            fontWeight: 700,
            backgroundColor: dark ? '#28394b' : '#f8fafb',
          },
        },
      },
    },
  })
}

// Retained for consumers requiring a static theme (e.g. existing tests).
export const jcoTheme = createJcoTheme('light')
