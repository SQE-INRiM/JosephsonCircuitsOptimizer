# AUD_20260901_003 — Setup code dialogs

## Scope
Review of the GUI-only change that moves Circuit definition and Cost & performance editing from permanently visible Setup text areas into MUI dialogs.

## Findings
- `src/screens/SetupScreen.tsx` is the only application source file changed.
- No scientific/runtime/serialization contract is changed.
- No new package or npm dependency is introduced.
- Both dialogs write through the pre-existing `updateCircuitCode` and `updateMetricsCode` store actions.
- The cost/performance dialog therefore retains the existing automatic metric extraction behavior.
- Parametric-source editing is unchanged.

## Validation status
Qualified: repository diff and code-path review performed through GitHub. Local TypeScript/Vite build and desktop interaction have not been run by the assistant and must be confirmed by the user before merge.

## Required local checks
1. `npm run build`
2. `npm test`
3. Open/close Circuit definition and edit one harmless line.
4. Open/close Cost & performance and confirm the output table responds to a named-return edit.
5. Confirm the Setup layout is materially shorter and clearer than `main`.
