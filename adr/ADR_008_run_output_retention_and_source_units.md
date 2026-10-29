# ADR 008 — Empty-run retention and immutable HB display units

- Status: accepted (pending PR integration)
- Date: 2026-10-29
- Scope: Electron run finalization, Results presentation and backward compatibility

## Context

The GUI previously archived an output folder even when a run produced no numerical data, and the HB Results selector applied one A/dBm unit to all sources based on the *current* Setup. The original numerical source amplitudes in JCO output are always in amperes. Existing run input snapshots did not include the GUI display-unit choice.

## Decision

1. **Retention:** after a run ends and before the project is repacked, remove its newly generated output directory only when the desktop bridge can establish that it contains *only* known inputs, logs and bookkeeping and no numerical output, saved array, optimizer history, plot or unknown artifact. Invalid/unreadable evidence and any possible partial result cause retention. Never sweep old runs or delete one still running. Repair the latest-run pointer after deletion.
2. **Snapshot:** for new desktop runs, copy the already-persisted `jco_gui_metadata.json` into that run's immutable `inputs_snapshot/` directory. Results reads its `sourceDisplay` settings (per-source `nonlinearAmplitudeUnit` and `impedanceOhm`) without changing the numerical data or project schema.
3. **Presentation:** convert stored A to display dBm only for sources originally configured in dBm, using the saved source impedance. Show other sources in A. Remove the global Results A/dBm toggle. If a historical run has no display-unit snapshot, show amplitudes in **dBm with the legacy 50-ohm default** as explicitly requested, not according to the current Setup.
4. **Open:** file drop and menu Open share the same validated `.jco` project loader; the renderer does not receive direct filesystem permissions.

## Compatibility / risks

The new run-local metadata is additive; older `.jco` archives are still readable. A historical display unit is not recoverable from SI-only outputs, so the dBm/50 Ω fallback is a **display convention**, not evidence of the original input unit or impedance. Run pruning intentionally errs toward retaining an ambiguous folder. Neither the solver, circuit model, HDF5 tables nor numerical algorithms change.

## Verification

Targeted Node tests for safe cleanup and pointer repair; Vitest for per-run source units and legacy fallback; CI for Electron syntax and the GUI build. Manual Windows/Electron validation on real JTWPA projects remains a separate acceptance check.
