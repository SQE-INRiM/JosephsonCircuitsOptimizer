# WI_20260828_006 — Results trace and resolved-parameter follow-up

## Goal

Address the first real-use findings from the Linear Results MVP without starting the deferred Optimization or nonlinear-feedback redesign.

## Acceptance criteria

- Synthetic preview Results are not shown while a scientific run is active or when no stored numerical run exists.
- Retained arrays are loaded only on explicit user request and can be plotted.
- A saved vector uses the common frequency axis when its length matches `frequency_hz`; otherwise it uses a generic integer index axis.
- Complex saved vectors can be inspected as magnitude, real part, imaginary part or phase.
- Heatmaps show explicit x tick values below the map and visible axis labels.
- Selected Linear points expose parameter values after `create_circuit(...)` has applied derived or modified values, while retaining the original sweep coordinates separately.
- The existing Optimization/HB Results behavior is not intentionally redesigned in this work item.

## Saved-data naming

Julia functions receive values, not the caller's source variable name. Therefore `save_datas(S21)` cannot reliably infer the text `S21`. The GUI runtime keeps this call valid with neutral internal naming and adds `@save_datas S21`, which stores the quantity/array name as `S21`. Explicit `filename=` / `prefix=` naming remains supported.

## Storage compatibility

The Linear summary HDF5 keeps its existing table datasets unchanged. New runs may additionally contain a `resolved_parameters/point_XXXXXX` group in `df_uniform_analysis.h5`. Historical runs without that group remain readable and fall back to the sweep coordinates or saved-data point metadata.

## Validation status

Static integration and branch diff review performed. A real Windows/Julia run is still required to verify HDF5 resolved-parameter persistence, named saved vectors, frequency-axis matching and on-demand plotting end to end. A local TypeScript/Vite build is also still required because no repository CI workflow is available to this agent.
