# WI_20260901_004 — Parametric sources in the GUI

## Classification
T2 — GUI/project-model workflow change with scientific input implications.

## Goal
Expose JCO's existing parametric-source mechanism without requiring users to manually encode Julia function names in `drive_physical_quantities.json`, and allow calibration `.txt` files used by those functions to travel with the `.jco` project.

## Compatibility contract
- JCO runtime behavior is unchanged.
- A parametric amplitude is still serialized as the Julia function-name string expected by JCO.
- The selected function must accept `device_params_set` (or `device_parameters_set`) as its first argument and return source current in A.
- Existing `user_parametric_sources.jl` files remain free-form Julia; helper functions are allowed.
- Existing auxiliary files are retained. `.txt` files are exposed to the GUI and stored inside `user_inputs/`.

## GUI behavior
- Linear and nonlinear amplitude mode selectors expose `Parametric` in addition to Fixed/Range/List.
- The function selector lists only functions whose first argument is the device-parameter dictionary.
- `Parametric functions` opens `user_parametric_sources.jl` in the same dialog style used for Circuit definition and Cost & performance.
- Calibration files are attached with an `Add .txt` control and can be removed from the project.

## Validation
- `npm run build`
- `npm test`
- Import the supplied legacy example and verify `calculate_source_1_amplitude` is detected as Parametric.
- Verify `find_flux_from_alpha` is not offered as a source function.
- Verify `flux_curve.txt` is listed, survives Save/reopen, and is present under `user_inputs/` during a run.
- Verify the serialized drive amplitude remains `"calculate_source_1_amplitude"`.
