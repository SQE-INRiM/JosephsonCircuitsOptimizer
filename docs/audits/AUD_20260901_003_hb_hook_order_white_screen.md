# AUD_20260901_003 — Harmonic Balance white-screen hook-order fix

## Classification
T2 — user-visible GUI runtime behavior.

## Problem
Opening the normalized Harmonic Balance Results view could blank the renderer even though TypeScript and Vite build succeeded.

## Root cause
`HbPointInspector` conditionally returned while `pointId` was initially `null` before reaching a later `useMemo`. When the Landscape selected the first stored point on the next render, React executed an additional hook and raised a hook-order runtime error.

## Change
Move the `plotGroups(...)` `useMemo` before the conditional empty-point return so every render of `HbPointInspector` executes the same hook sequence.

## Verification
- Added a regression test asserting the memo hook remains before the conditional return.
- PR CI must pass `npm test` and `npm run build` before merge.

## Limitations
Windows/Electron interaction with the user's real HB dataset remains the final manual acceptance check.

## Status
Qualified pending PR CI and local Windows/Electron confirmation.
