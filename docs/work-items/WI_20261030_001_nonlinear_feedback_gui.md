# Work item: nonlinear feedback GUI setup (v0.4.2 candidate)

Date: 2026-10-30
Branch: `feat/nonlinear-feedback-v0.4.2`
Classification: T2 GUI/serialized-input work, with T3 scientific-validation follow-up.

## Goal

Make the existing JCO nonlinear correction hook configurable through GUI Setup without changing the mathematical definition or the numerical backend.

## Existing scientific contract (unchanged)

- `user_nonlinear_correction(S_linear, sol, device_params_set)` receives extracted linear S-parameters and the nonlinear JC solution, returning a scalar correction.
- `user_cost(sol, device_params_set, nonlinear_correction)` receives the correction in its third argument. The user's metric explicitly decides whether and how to include it.
- Correction cycles are only executed in the full multi-parameter workflow, not single-point runs.
- A scalar constant offset need not alter an optimizer minimizer; no scientific improvement is claimed by exposing the controls.

## GUI and serialization

- Add a feedback enable control (0 cycles when off) and a number of correction iterations on the Computation screen.
- Accept one fixed numeric reference current, in amperes, for each source (including DC sources), independently of the nonlinear sweep values.
- Use existing keys `n_iterations_nonlinear_correction` in `simulation_config.json` and `source_i_non_linear_amplitude_for_delta_correction` in `drive_physical_quantities.json`. No `.jco` schema change.
- Keep old projects importable; no automatic modification of their user-defined Julia metric functions.
- Show the correction hook in the Metrics panel; both the cost and correction are edited in the existing `user_cost_and_performance.jl` source.
- Default the setting to off for new projects. Existing projects retain their configured cycle count.
- Reject saves with enabled cycles but missing or nonfinite reference currents, including `NaN`, while allowing zero and negative currents.

## Verification

- Added targeted GUI editor tests for cycles, enable state, current editing and hook visibility.
- Added Node serialization tests for round-trip and invalid-source-current rejection.
- Automated full npm tests, build, GUI interaction, and real Julia HB runs still require independent execution; do not claim them completed until performed.
- Before a v0.4.2 release, confirm the packaging workflow and correction-cycle results with a representative .jco.

## Follow-ups / known legacy risks

- The existing Julia feedback loop has not been refactored; the output handling and HB convergence need separate validation.
- Verify saved correction cycles and reference currents on a real multi-source project.
- Consider a more explicit pre-run warning for feedback functions that return a constant correction, without enforcing a physical choice in the GUI.
