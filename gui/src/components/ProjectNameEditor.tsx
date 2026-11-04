import { useEffect, useRef, useState } from 'react'
import { Button, TextField, Tooltip, Typography } from '@mui/material'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { useAppStore } from '../store'

/** One visible, editable project title across all GUI sections.
 * The .jco filename remains available internally for Save/Save As. */
export function ProjectNameEditor() {
  const name = useAppStore((state) => state.project.name)
  const dirty = useAppStore((state) => state.dirty)
  const updateProjectName = useAppStore((state) => state.updateProjectName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const discardOnBlur = useRef(false)

  useEffect(() => {
    setDraft(name)
    setEditing(false)
  }, [name])

  const commit = () => {
    if (discardOnBlur.current) {
      discardOnBlur.current = false
      return
    }
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) updateProjectName(trimmed)
    else setDraft(name)
  }

  if (editing) {
    return (
      <TextField
        autoFocus
        size="small"
        variant="outlined"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.querySelector('input')?.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            discardOnBlur.current = true
            setDraft(name)
            setEditing(false)
          }
        }}
        slotProps={{ htmlInput: { 'aria-label': 'Project name' } }}
        sx={{
          width: { xs: 165, sm: 260, lg: 360 },
          '& .MuiOutlinedInput-root': { color: '#fff', fontWeight: 700, height: 38 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,.5)' },
          '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
        }}
      />
    )
  }

  return (
    <Tooltip title="Rename project">
      <Button
        color="inherit"
        size="small"
        aria-label={`Rename project: ${name}`}
        onClick={() => { discardOnBlur.current = false; setDraft(name); setEditing(true) }}
        endIcon={<EditRoundedIcon sx={{ fontSize: '15px !important', opacity: 0.7 }} />}
        sx={{
          maxWidth: '100%',
          minWidth: 0,
          px: 0.8,
          justifyContent: 'flex-start',
          textAlign: 'left',
          textTransform: 'none',
          color: '#fff',
          '&:hover': { backgroundColor: 'rgba(255,255,255,.1)' },
        }}
      >
        <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {name}{dirty ? ' *' : ''}
        </Typography>
      </Button>
    </Tooltip>
  )
}
