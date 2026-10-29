// Display-only Electron zoom preferences (independent of .jco projects).
const MIN_ZOOM = 70
const MAX_ZOOM = 150
const ZOOM_STEP = 10

function normalizeZoom(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 100
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(numeric / ZOOM_STEP) * ZOOM_STEP))
}

function stepZoom(value, direction) {
  const step = direction > 0 ? ZOOM_STEP : direction < 0 ? -ZOOM_STEP : 0
  return normalizeZoom(normalizeZoom(value) + step)
}

function zoomShortcut(input) {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null
  const key = String(input.key || '').toLowerCase()
  const code = String(input.code || '')
  if (key === '0' || code === 'Digit0' || code === 'Numpad0') return { type: 'reset' }
  if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd' || key === 'add') return { type: 'step', direction: 1 }
  if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract' || key === 'subtract') return { type: 'step', direction: -1 }
  return null
}

module.exports = { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, normalizeZoom, stepZoom, zoomShortcut }
