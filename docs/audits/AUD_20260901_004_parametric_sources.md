# AUD_20260901_004 — Parametric sources

Status: Qualified pending local validation.

## Outcome
- Added GUI Parametric mode for linear and nonlinear source amplitudes without changing the JCO runtime contract.
- Function discovery only exposes Julia functions whose first argument is the device-parameter dictionary.
- Added dialog editing for `user_parametric_sources.jl`.
- Added project-contained `.txt` calibration attachments.
- Added desktop regression coverage for calibration persistence and function-name serialization.
- No new npm dependency was introduced.

## Scientific/compatibility review
The supplied example defines a helper `find_flux_from_alpha(alpha)` and a source function `calculate_source_1_amplitude(device_params_set::Dict)`. The GUI distinction matches that contract: only the latter is selectable. Its return value is a current in A, matching JCO's existing source interface. The supplied `flux_curve.txt` remains available at `config.user_inputs_dir` after Save/Run.

## Checks still required locally
- `npm run build`
- `npm test`
- Open/import the supplied example and inspect the Sources panel.
- Save/reopen and run once to verify the attached calibration file is materialized before Julia loads `user_parametric_sources.jl`.

## Limitations
- Calibration attachment UI currently manages `.txt` files only.
- Function discovery intentionally recognizes the standard explicit `function name(device_params_set...)` form; unusual Julia shorthand/dispatch patterns remain editable in the Julia dialog but are not auto-listed.
