import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { getJcoAdapter } from '../services/jcoAdapter'
import packageJson from '../../package.json'

const REPOSITORY = 'https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer'
const DOI = 'https://doi.org/10.1109/TASC.2026.3679488'
export const JCO_CITATION = 'E. Palumbo et al., "JCO: Optimization Framework for Nonlinear Superconducting Circuits Using a Lumped-Element Approach and Harmonic Balance," IEEE Transactions on Applied Superconductivity (2026). https://doi.org/10.1109/TASC.2026.3679488'

interface AboutJcoDialogProps {
  open: boolean
  onClose: () => void
}

export function AboutJcoDialog({ open, onClose }: AboutJcoDialogProps) {
  const [feedback, setFeedback] = useState('')

  const openLink = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    const openExternal = getJcoAdapter()?.openExternal
    if (!openExternal) return // Browser previews use the normal link target.
    event.preventDefault()
    void openExternal(url).catch(() => setFeedback('Unable to open the link in your browser.'))
  }

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(JCO_CITATION)
      setFeedback('Citation copied to clipboard.')
    } catch {
      setFeedback('Unable to copy the citation to the clipboard.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="jco-about-title">
      <DialogTitle id="jco-about-title">About JCO</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.2}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Box
              component="img"
              src="./jco-logo.svg"
              alt="JCO — Josephson Circuits Optimizer"
              sx={{ display: 'block', width: '100%', maxWidth: 340, height: 'auto', borderRadius: 1.5 }}
            />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6">Josephson Circuits Optimizer</Typography>
            <Typography variant="caption" color="text.secondary">Version {packageJson.version}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Automated design and optimization of nonlinear superconducting circuits using harmonic balance.
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2">Development &amp; collaboration</Typography>
            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>Emanuele Palumbo</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.2 }}>
              INRiM – Politecnico di Torino
            </Typography>
            <Link
              href="mailto:emanuele.palumbo@polito.it"
              onClick={(event) => openLink(event, 'mailto:emanuele.palumbo@polito.it')}
              sx={{ display: 'inline-block', mt: 1, fontSize: '0.875rem' }}
            >
              emanuele.palumbo@polito.it
            </Link>
          </Box>
          <Box>
            <Typography variant="subtitle2">Repository &amp; support</Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
              <Link href={REPOSITORY} target="_blank" rel="noopener noreferrer" onClick={(event) => openLink(event, REPOSITORY)}>GitHub repository</Link>
              <Link href={`${REPOSITORY}/issues`} target="_blank" rel="noopener noreferrer" onClick={(event) => openLink(event, `${REPOSITORY}/issues`)}>Report an issue</Link>
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle2">How to cite</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              E. Palumbo <i>et al.</i>, “JCO: Optimization Framework for Nonlinear Superconducting Circuits Using a Lumped-Element Approach and Harmonic Balance,” <i>IEEE Transactions on Applied Superconductivity</i> (2026).
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 1, rowGap: 1 }}>
              <Link href={DOI} target="_blank" rel="noopener noreferrer" onClick={(event) => openLink(event, DOI)}>DOI: 10.1109/TASC.2026.3679488</Link>
              <Button size="small" variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyCitation()}>Copy citation</Button>
            </Stack>
          </Box>
          <Divider />
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">Open-source software · MIT License</Typography>
            <Link variant="caption" href={`${REPOSITORY}/blob/main/LICENSE.md`} target="_blank" rel="noopener noreferrer" onClick={(event) => openLink(event, `${REPOSITORY}/blob/main/LICENSE.md`)}>View license</Link>
          </Stack>
          {feedback && <Typography role="status" variant="caption" color="text.secondary">{feedback}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  )
}
