# AUD_20261029_002 — Run cleanup, Results units and project file drag/drop

- Date: 2026-10-29
- Type: change
- Tier: T2
- Status: **qualified** pending desktop/real-run review
- Branch: `feat/empty-run-cleanup-stored-units-file-drop`
- Related work item: `WI_20261029_001_run_cleanup_units_drag_drop.md`
- Architecture: `ADR_008_run_output_retention_and_source_units.md`

## Scope

Review the conservative post-run cleanup, per-run display metadata and Open-equivalent `.jco` drag/drop. A related parameter editor usability regression was addressed while reviewing the file-drop change: List values now use an explicitly labeled editable field instead of a disabled primary cell. A concurrent startup New project initialization could also overwrite a project dropped immediately after the app opened; startup project creation and file opening are now serialized. The default deletion policy is deliberately conservative; any uncertain output is retained.

## Intended safeguards

- Only the output of the just-finished run can be automatically removed, after the Julia process finishes and before durable repacking.
- HDF5, user-saved arrays, optimizer metric history, figures and unexpected files prevent deletion even when the run failed/cancelled.
- New runs copy the GUI metadata into `inputs_snapshot/`; historical runs without it default to dBm with assumed 50 Ω for **display only**.
- Invalid file drops cannot change the current project; active runs and unsaved changes are protected. The file-drop overlay is cleared even when Chromium omits `Files` on the final drop event, and early drops cannot be overwritten by the startup New project response.
- Switching device parameter modes clears obsolete values at the Zustand state level, so disabled fields do not retain Range Stop/Step or get unexpectedly serialized.

## Automated evidence

Targeted unit tests are committed under `gui/desktop/empty-run-cleanup.node-test.cjs`, `gui/src/components/HarmonicBalanceResultsWithUnits.test.ts`, interactive parameter mode tests in `gui/src/screens/SetupScreen.test.tsx`, state tests in `gui/src/store.test.ts`, and file-drop/startup integration tests in `gui/src/App.file-drop.test.tsx`. GitHub Actions CI status will be the authoritative evidence for whether these tests and the TypeScript build actually passed.

## Limitations

- This audit does **not** certify the runtime behavior of a real numerical JTWPA simulation. No new Julia numerical equivalence run or Windows file-drop interaction has been independently recorded here.
- Empty-run detection intentionally retains suspicious/unrecognized files, even when they are not ultimately numerical. Therefore it may leave some empty runs in preference to accidental data loss.
- Historical display dBm values use 50 Ω unless a saved per-run GUI impedance is available; earlier user choices cannot be reconstructed from stored SI currents alone.
- Manual Windows/Electron integration should verify that auto-save contains no deleted blank run, and that retained partial results survive cancellation.

## Status

**Qualified:** repository-side changes and automated test definitions are recorded. Runtime/system and scientific validation remain explicit follow-up work and must not be represented as completed without evidence.
