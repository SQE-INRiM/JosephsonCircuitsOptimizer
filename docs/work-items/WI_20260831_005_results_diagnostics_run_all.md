# WI_20260831_005 — Results diagnostics and Run all

Status: in progress
Risk tier: T2

## Goal

Make stage reuse explicit in the Run UI and make missing Optimization Results diagnosable without changing the scientific optimizer.

## Findings

- `Run remaining` intentionally reuses valid earlier stages. When Linear remains valid and Optimization + HB are selected, the desktop maps the request to `from_latest`.
- Changing a setup parameter makes Linear stale, so the next remaining-stage request executes the full pipeline.
- Optimization execution can complete while the Results table remains unavailable; this is a persistence/indexing boundary issue and should not be diagnosed by changing optimizer mathematics.
- Results no longer polls every four seconds, so a manual refresh control is useful for explicit re-indexing.

## Acceptance criteria

1. Add an explicit `Run all` control that always requests a fresh complete pipeline instead of reusing completed stages.
2. Keep `Run remaining` semantics unchanged and describe the difference clearly in the UI.
3. Add a lightweight latest-run Optimization diagnostic showing run status, Linear-table readability, Optimization-table readability, and the number of bookkeeping cost-history evaluations.
4. Add a manual `Refresh results` control without restoring continuous polling.
5. Every new Optimization persistence attempt writes a small diagnostic JSON with initial-evaluation count, total history count, BO count, parameter columns, and HDF5 write outcome.
6. Do not modify simulation equations, cost definitions, surrogate strategy, or optimizer sampling behavior.
