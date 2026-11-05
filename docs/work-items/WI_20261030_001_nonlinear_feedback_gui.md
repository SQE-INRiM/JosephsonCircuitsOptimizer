# Work item: nonlinear feedback GUI setup (v0.4.3 candidate)

Date: 2026-10-30
Branch: `feat/nonlinear-feedback-v0.4.2` (historical branch name retained for draft PR #24; planned release v0.4.3)
Classification: T2 GUI/serialized-input work **and T3 user-code contract change**; scientific reference validation pending.

The **v0.4.2** release was published on 2026-10-30. The original PR #24 is now reconciled to the published `main` baseline while retaining its history; nonlinear feedback targets **v0.4.3** and is not part of the published v0.4.2 artifacts.

## Goal

Make nonlinear feedback configurable in GUI Setup and provide a consistent full-solution Julia hook, while retaining the user-defined scalar correction and optimization rules.

## Scientific API contract (updated in PR #24)

- `user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)` receives **two full JC `hbsolve` solutions** and returns the user-defined scalar correction. The linear input comes from `linear_solution`, and the nonlinear input from `nonlinear_simulation(...).sol`.
- Both standalone and desktop HB loops reuse one linear solution per source-frequency configuration across the nonlinear amplitude grid.
- `user_cost(sol, device_params_set, nonlinear_correction)` receives the correction in its third argument. The user's metric explicitly decides whether and how to include it.
- Correction cycles are only executed in the full multi-parameter workflow, not single-point runs.
- A scalar constant offset need not alter an optimizer minimizer; no scientific improvement is claimed by exposing the controls.

## GUI and serialization

- Add a feedback enable control (0 cycles when off) and a number of correction iterations on the Computation screen.
- Accept one fixed numeric reference current, in amperes, for each source (including DC sources), independently of the nonlinear sweep values.
- Use existing keys `n_iterations_nonlinear_correction` in `simulation_config.json` and `source_i_non_linear_amplitude_for_delta_correction` in `drive_physical_quantities.json`. No `.jco` schema change.
- Keep old projects importable without automatically rewriting user Julia code. **Compatibility note:** legacy feedback functions that index the first input as an S dictionary must be manually migrated to `sol_linear.linearized.S(...)`; a no-op `return 0.0` remains compatible. See `adr/ADR_009_nonlinear_feedback_solution_contract.md`.
- Provide three separate code editors in Metrics & constraints: **Cost**, **Performance**, and **Nonlinear correction**. Each shows *only its function*, while Save splices that function into the original `user_cost_and_performance.jl` source with all other text, auxiliary code, comments and formatting preserved byte-for-byte. Explicit Save/Cancel avoids modifying user source while typing. A **Full Julia file** fallback remains accessible when safe isolation is impossible (duplicate definitions, short-form code or unsupported Julia constructs). No `.jco` schema change; the feedback Julia input contract changes intentionally.
- Default the setting to off for new projects. Existing projects retain their configured cycle count.
- Reject saves with enabled cycles but missing or nonfinite reference currents, including `NaN`, while allowing zero and negative currents.

## Verification

- Added targeted GUI editor tests for cycles, enable state, current editing, isolated function-only code views, Save/Cancel, full-file fallback and preservation of other source contents. Added parser/round-trip tests for nested Julia blocks, comments, triple strings, Unicode offsets, missing definitions and ambiguous syntax.
- Added Node serialization tests for round-trip and invalid-source-current rejection.
- The original branch's npm checks passed before reconciliation. Re-run automated npm tests/build and desktop packaging on the v0.4.3 head; real Julia HB and scientific feedback-loop validation still require independent execution. Do not claim them completed until performed.
- Before a v0.4.3 release, confirm the packaging workflow and correction-cycle results with a representative .jco.

## Follow-ups / known legacy risks

- The existing Julia feedback-cycle algorithm and scalar correction model have not been refactored; corrected-cycle output selection, convergence and physical significance need separate validation.
- End-to-end Julia/HB validation must compare zero-mode S extraction from full linear solutions against the previous `linear_simulation` dictionary at the same point and verify that the new hook receives both complete solution objects.
- Verify saved correction cycles and reference currents on a real multi-source project.
- Consider a more explicit pre-run warning for feedback functions that return a constant correction, without enforcing a physical choice in the GUI.
