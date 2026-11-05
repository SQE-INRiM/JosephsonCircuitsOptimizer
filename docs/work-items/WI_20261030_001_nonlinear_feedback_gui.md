# Work item: nonlinear feedback GUI setup (draft PR #24; next release TBD)

Date: 2026-10-30
Branch: `feat/nonlinear-feedback-v0.4.2` (historical name retained; target release TBD).
Classification: T2 GUI/serialized-input work **and T3 user-code contract change**; scientific reference validation pending.

The published `main` baseline is **v0.4.3** (2026-11-04). Draft PR #24 is based on that release baseline but remains unpublished and must not be represented as part of v0.4.3.

## Goal

Make nonlinear feedback configurable in GUI Setup and provide a consistent full-solution Julia hook, while retaining the user-defined scalar correction and optimization rules.

## Scientific API contract (updated in PR #24)

- `user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)` receives **two full JC `hbsolve` solutions** and returns the user-defined scalar correction. The linear input comes from `linear_solution`, and the nonlinear input from `nonlinear_simulation(...).sol`.
- Both standalone and desktop HB loops reuse one linear solution per source-frequency configuration across the nonlinear amplitude grid.
- `user_cost(sol, device_params_set, nonlinear_correction)` receives the correction in its third argument. The user's metric explicitly decides whether and how to include it.
- Correction cycles are only executed in the full multi-parameter workflow, not single-point runs.
- A scalar constant offset need not alter an optimizer minimizer; no scientific improvement is claimed by exposing the controls.

## GUI and serialization

- Add feedback enable (0 cycles when off) and **Fixed cycles** or **Metric convergence** modes. Convergence selects Cost / Performance / Correction and absolute or relative (%) tolerance, with a maximum cycle budget (at least two) enforced by the full Julia workflow; see `adr/ADR_010_nonlinear_feedback_stopping.md`.
- Remove redundant explanatory text and the inline function signature from Metrics while keeping all three distinct function editors.
- Accept one fixed numeric reference current, in amperes, for each source (including DC sources), independently of the nonlinear sweep values.
- Preserve `n_iterations_nonlinear_correction` as the fixed count or maximum cycles and `source_i_non_linear_amplitude_for_delta_correction` for reference currents. Add optional `nonlinear_feedback_stop_mode`, `nonlinear_feedback_metric`, `nonlinear_feedback_tolerance_type`, `nonlinear_feedback_tolerance` to `simulation_config.json`. Existing `.jco` archives and legacy fixed-cycle behavior remain compatible.
- Keep old projects importable without automatically rewriting user Julia code. **Compatibility note:** legacy feedback functions that index the first input as an S dictionary must be manually migrated to `sol_linear.linearized.S(...)`; a no-op `return 0.0` remains compatible. See `adr/ADR_009_nonlinear_feedback_solution_contract.md`.
- Provide three separate code editors in Metrics & constraints: **Cost**, **Performance**, and **Nonlinear correction**. Each shows *only its function*, while Save splices that function into the original `user_cost_and_performance.jl` source with all other text, auxiliary code, comments and formatting preserved byte-for-byte. Explicit Save/Cancel avoids modifying user source while typing. A **Full Julia file** fallback remains accessible when safe isolation is impossible (duplicate definitions, short-form code or unsupported Julia constructs). No `.jco` schema change; the feedback Julia input contract changes intentionally.
- Default the setting to off for new projects. Existing projects retain their configured cycle count.
- Reject saves with enabled cycles but missing or nonfinite reference currents, including `NaN`, while allowing zero and negative currents.

## Verification

- Added targeted GUI editor tests for cycles, enable state, current editing, isolated function-only code views, Save/Cancel, full-file fallback and preservation of other source contents. Added parser/round-trip tests for nested Julia blocks, comments, triple strings, Unicode offsets, missing definitions and ambiguous syntax.
- Added Node serialization tests for round-trip, invalid source currents and stopping criteria, including invalid tolerance or insufficient maximum cycles; browser tests exercise criterion/metric/tolerance selections. Added a standalone pure Julia numerical test script `test/feedback_convergence.jl` (not yet executed locally).
- The original branch's npm checks passed before reconciliation. Re-run automated npm tests/build and desktop packaging on the v0.4.3 head; real Julia HB and scientific feedback-loop validation still require independent execution. Do not claim them completed until performed.
- Before releasing nonlinear feedback, confirm packaging, actual convergence stopping, the `nonlinear_feedback_stopping.json` history/reason and correction-cycle results with a representative .jco.

## Follow-ups / known legacy risks

- The scalar feedback correction model remains unchanged. The full Julia feedback loop now applies the selected convergence criterion after completed corrected cycles; the corrected-cycle HB optimum amplitude is extracted from the matching cycle rather than reusing the initial result. End-to-end Julia/HB validation of both changes remains pending.
- End-to-end Julia/HB validation must compare zero-mode S extraction from full linear solutions against the previous `linear_simulation` dictionary at the same point and verify that the new hook receives both complete solution objects.
- Verify saved correction cycles and reference currents on a real multi-source project.
- Consider a more explicit pre-run warning for feedback functions that return a constant correction, without enforcing a physical choice in the GUI.
