import { createTheme } from '@mui/material/styles'

export const jcoTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#173a63', dark: '#102b4a', light: '#e8f0f8' },
    secondary: { main: '#c7892f', dark: '#8f5f1e', light: '#fff3dc' },
    success: { main: '#2d7d64' },
    warning: { main: '#b06b1c' },
    error: { main: '#b74646' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: '#172231', secondary: '#607080' },
    divider: '#dce2e8',
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
    MuiTableCell: { styleOverrides: { head: { color: '#607080', fontWeight: 700, backgroundColor: '#f8fafb' } } },
  },
})
