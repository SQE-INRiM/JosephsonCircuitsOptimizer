# ADR 006 — Parametric source GUI contract

Status: Accepted

## Context
JCO already supports parametric source amplitudes by storing a Julia function name in the source-amplitude field, loading `user_parametric_sources.jl`, and invoking that function with the current device-parameter dictionary. The raw representation is powerful but not intuitive in a GUI. Parametric functions may also depend on calibration files such as `flux_curve.txt` located in `user_inputs/`.

## Decision
1. Preserve the existing JCO runtime representation and behavior.
2. Present `Parametric` as a GUI-only amplitude mode. Internally it is represented by the existing Fixed/string source specification so old and new projects serialize to the same function-name string.
3. Discover selectable source functions from `user_parametric_sources.jl` only when their first argument is `device_params_set` or `device_parameters_set`. Helper functions remain visible in the code editor but are not offered as source bindings.
4. Parametric functions return canonical source current in A. dBm remains a display/input option only for non-parametric scalar/sweep amplitudes.
5. Store attached calibration `.txt` contents in the GUI project model and materialize them under `user_inputs/` on Save/Run. This keeps paths project-relative and makes the `.jco` portable.
6. Use the same ordinary code dialog pattern already used for Circuit definition and Cost & performance; do not introduce an editor dependency.

## Consequences
- Existing JCO projects using function-name strings remain compatible.
- The GUI hides the unusual raw JSON notation while preserving scientific flexibility.
- Calibration files travel with the project rather than relying on machine-specific absolute paths.
- Renaming/removing a Julia function can leave an old source binding unresolved; validation/UI warnings should make this visible rather than silently substituting another function.
