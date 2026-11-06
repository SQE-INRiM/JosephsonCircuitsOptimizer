# WI 2026-11-06 — Reuse feedback correction already evaluated by nonlinear HB

Status: committed to `gui/run-feedback-cycle-progress` (PR #41); solver-level acceptance pending.

## Motivation

The full Julia feedback loop previously called `nonlinear_correction(optimal_params, reference_amplitudes)` before **every corrected cycle**. That convenience function performs one new `linear_solution` solve and one `nonlinear_simulation` solve at the selected reference currents. Meanwhile, both the CLI and GUI `run_nonlinear_simulations_sweep` already evaluate `user_nonlinear_correction(sol_linear, sol_nonlinear, optimal_params)` for **each** nonlinear HB sweep point, retaining its scalar result as `delta_quantity`.

## Change

- After the baseline and each corrected sweep, keep using the in-memory `results` from that most recent sweep. No extra collection of HB solution objects or disk-based cache is needed.
- Before starting the next corrected cycle, `feedback_correction_from_sweep(results, reference_amplitudes, reference_frequencies)` searches for a **converged** point whose entire ordered source-amplitude vector **and** entire ordered source-frequency vector match the reference. The default scalar frequencies in `sim_vars` are exactly those previously used by the dedicated `nonlinear_correction` path.
- Match finite numerical source values with a tight relative tolerance (`rtol=1e-12`, `atol=0`) to allow insignificant floating-point grid rounding, not genuinely different pump settings. Do not reuse a missing, non-finite or non-real correction.
- For a hit, reuse the existing per-point `delta_quantity` (the user-defined correction was already evaluated during the sweep), then proceed with the original feedback update and convergence logic. **Do not rerun linear or nonlinear HB** at the same working point.
- For a miss (reference not in the sweep, frequency mismatch, failed/nonconverged reference point, incomplete results), retain the original `nonlinear_correction(optimal_params, reference_amplitudes)` path and its error handling.
- The same rule applies to every cycle: cycle 1 consumes baseline results; cycle 2 consumes cycle 1 results; etc. The source-circuit and user-hook contracts remain unchanged. No change to stored HDF5 schemas, GUI results, or .jco archives.

## Validation

The pure `src/FeedbackReuse.jl` helper can be tested without starting JosephsonCircuits:

```bash
julia --project=. test/feedback_reuse.jl
```

The tests exercise multi-source (RF + DC) matching, frequency sweeps, strict numerical tolerance, nonconvergence, invalid correction values, and replacing the prior cycle's result. Static inspection confirms that both CLI and GUI sweeps fill `delta_quantity` by calling the same `user_nonlinear_correction` hook.

**Pending:** execute the Julia test and a real GUI/Julia multi-cycle HB run in the user's environment. Compare results of a matching-reference run to the old explicit solve, test a reference outside the grid, and check memory use. The existing feedback solver's scientific validity remains a separate review item. This optimization assumes the user correction is a deterministic function of its documented solver inputs; intentional stateful side effects are not replayed.
