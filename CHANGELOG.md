# Changelog

This changelog records completed user-relevant and development-process changes. Git history remains the detailed implementation record.

## Unreleased

### Application
- Harden fresh-checkout Circuit Preview/runtime startup: materialize the Julia environment when needed, cache runtime readiness against the Julia path and project files, and prepare the GUI runtime before preview execution.
- Update GUI launch/bootstrap dependencies for the unified repository, including Electron 43.4.1 and `adm-zip` 0.6.0.
- Start the desktop GUI from a neutral unsaved `New project` workspace instead of a Carthago-specific preview state, with guidance to open bundled examples from the project menu.
- Keep bundled `.jco` examples directory-driven: valid projects added under `gui/runtime/examples/` are discovered from their manifests without a hard-coded registry.
- Allow bundled examples to run directly in their temporary session without `Save As`, while ordinary new/imported unsaved projects still require a durable `.jco` path before scientific execution.
- Keep circuit-preview generation active while the user configures other Setup sections, and preserve stale detection when circuit code or preview parameters change during generation.
- Clarify that resolved circuit generation can take time for complex circuits.

### Governance
- Refresh `governance/repository-status.md` for the unified `SQE-INRiM/JosephsonCircuitsOptimizer` repository and retain the Sep 7–10 migration/release/fresh-install history as the current recovery baseline.
- Add a qualified historical audit for the Circuit Preview fresh-install/runtime-bootstrap follow-up without claiming checks that were not retained as evidence.
- Track the example lifecycle and background circuit-preview behavior as a T2 GUI/desktop-bridge change with explicit acceptance criteria and qualified validation evidence.
### Packaging
- Add build-time staging of the authoritative root JCO Julia package for packaged Electron applications.
- Add Windows x64 NSIS installer + portable packaging and Linux x64 AppImage packaging.
- Add GitHub Actions jobs for Windows/Linux desktop artifacts while keeping Julia as an external runtime requirement.


## 0.3.0 - 2026-09-08

### Governance
- Introduced a lightweight repository-native agent operating contract through `AGENTS.md`.
- Added risk-tiered audit rules and scientific-integrity checks tailored to JCO-GUI.
- Added repository recovery/status documentation and ADR/work-item traceability.
- Preserved the older `governance/baseline` branch as historical evidence instead of merging its stale assumptions into current `main`.
- Simplified governance so ADRs, audits and work items are context/evidence tools rather than automatic merge gates.
- A `qualified` audit now records pending validation without blocking integration; explicit maintainer instructions to proceed are preserved together with the unresolved limitations.
- Added WI/AUD tracking for the Results semantic split between uniform-space circuit analysis and optimizer diagnostics.
- Refined ADR 002 after local Results validation to preserve JCO 1D density semantics on uniform Linear data and document negative-metric normalization.
- Extended ADR 002 and WI/AUD tracking for exact higher-dimensional Linear slicing and explicit correlation column modes.
- Added ADR 003 and WI/AUD tracking for Harmonic Balance source-space slicing, convergence filtering, nonlinear retained data and amplitude-response semantics.
- Added a pull-request CI check that runs the renderer tests and TypeScript/Vite build before integration.
- Added WI/AUD tracking for Harmonic Balance retained-array X-axis selection and multi-run project cleanup.
- Added WI/AUD tracking for visual/interaction normalization of Harmonic Balance Results against the Linear Results reference UI.
- Added WI/AUD tracking for HB source-configuration terminology and Run completion-time consistency.

### Application
- Connected the Run screen's stage-specific control to the real desktop runner.
- Added explicit cancellation feedback and a forced Julia process-tree fallback
  when graceful STOP polling cannot interrupt a long solver call.
- Made the GUI run ID identical to the Julia output-folder ID and require Save
  As before a scientific run so results are retained in the `.jco` project.
- Clarified the Current Run panel and changed linear-only execution to retain
  HDF5/metadata without generating correlation images.
- Replaced project-specific Run-stage demo descriptions with neutral `Linear`,
  `Optimization`, and `Harmonic balance` descriptions derived from the real workflow.
- Added backend-derived stage completion timestamps and elapsed durations using
  Julia `PROGRESS_DONE` events instead of hard-coded demo times.
- Added stable `point_id` values to Linear and nonlinear summary tables so detailed
  saved arrays can be addressed exactly without floating-point parameter matching.
- Made `save_datas(...)` the default frequency-resolved persistence mechanism for
  GUI runs, consolidating selected arrays into `saved_data/linear.h5`,
  `saved_data/nonlinear.h5`, or `saved_data/custom.h5` under the active point ID.
- Changed full fundamental S-parameter capture to explicit diagnostic mode
  (`trace_storage_mode = "all"`) instead of retaining every trace by default;
  `selected` is the scalable default and `none` disables detailed-array saving.
- Disabled automatic plot-image persistence for GUI-launched runs; plots remain
  derivable later from summary tables and whichever numerical arrays the user chose to save.
- Fixed Optimization after the point-addressable schema change: the optimizer now
  uses only real `device_parameters_space` columns and the explicit `metric` objective,
  so `point_id` and additional analysis metrics can never become optimization variables.
- Made additional named Linear metrics sparse-safe: masked or early-return points are
  represented by `NaN` for unavailable analysis metrics instead of producing unequal
  DataFrame column lengths.
- Changed bare `save_datas(array)` calls to follow the active stage automatically;
  explicit `category="custom"` remains available for stage-independent data.
- Fixed optimal-device JSON bookkeeping so model-derived parameters populated by
  `create_user_circuit` are materialized before `optimal_device_parameters*.json` is
  written, while leaving optimizer coordinates and simulation numerics unchanged.
- Replaced the real Linear Results fallback with a point-addressable 1D/2D viewer
  driven by the stored summary table, including exact `point_id` selection and a
  selected-configuration inspector for device parameters and scalar metrics.
- Added masked-cell rendering for Linear heatmaps so `1e8` metric sentinel points are
  left white and excluded from the displayed color scale instead of flattening useful data.
- Added a lightweight catalogue of `saved_data/linear.h5` quantities and array shapes
  for each point without eagerly transferring frequency-resolved numerical arrays to React.
- Deferred cross-stage comparison rather than silently collapsing incompatible datasets; the Results `Compare runs` action remains hidden for now.
- Added exact higher-dimensional Linear slicing: choose any two varying parameters as Landscape axes and fix every remaining varying parameter to one of its stored values, without averaging or interpolation.
- Made Linear Point data follow the active higher-dimensional slice when fixed coordinates or axes change.
- Changed Linear Correlation to default to parameter-only columns (`None`) and added an explicit `Metrics` option that includes all stored scalar metrics.
- Removed the legacy synthetic Results preview state while a scientific run is active
  or when the project has no stored numerical results yet.
- Added explicit bottom x-axis tick values and axis labels to heatmaps.
- Added on-demand plotting of retained Linear arrays: a matching root `frequency_hz`
  axis is displayed in GHz, otherwise the trace uses generic integer indices.
- Added magnitude, real, imaginary and phase views for retained complex arrays without
  eagerly loading those arrays when the Results page opens.
- Added post-`create_circuit(...)` resolved Linear parameter snapshots per `point_id`,
  shown separately from the original sweep coordinates in the selected-point inspector.
- Added `@save_datas S21` as a name-preserving convenience for Julia user metrics;
  ordinary `save_datas(S21)` remains supported with neutral internal naming, and the
  existing `category="auto"` / explicit `category="custom"` behavior is preserved.
- Reworked Results into compact analysis views so only one principal visualization is shown at a time, reducing vertical scrolling.
- Moved parameter/metric correlation and JCO-style 1D density analysis to Linear Results and compute them only from the persisted uniform Linear dataset.
- Restored the JCO `plot_1d_density_heatmap` weighting semantics (`count / mean(metric)`) in Linear Results, while replacing maximum-only normalization with bounded min-max normalization so negative metrics remain correctly visible on a 0–1 scale.
- Placed selected Point data directly below the Linear Landscape so clicking a heatmap cell immediately updates the adjacent configuration/metric/retained-array inspector; the full stored-configuration table is now optional.
- Simplified Optimization Results to optimizer diagnostics only: `Best sampled objective` and raw per-parameter history versus evaluation number.
- Removed metric weighting/normalization from optimization parameter-history plots so displayed parameter values are the actual optimizer samples.
- Added adaptive scientific-number formatting to Optimization y axes and tooltips so small non-zero SI-scale parameter values and metrics are no longer rendered as zero.
- Extended Optimization Parameter history with an `All parameters` option that shows separate compact raw-value charts instead of overlaying incompatible scales.
- Replaced the generic Harmonic Balance Results fallback with a source-space explorer supporting selectable source frequency/amplitude axes, exact fixed-coordinate slicing and `All / Converged / Non-converged` filtering.
- Added point-addressable Harmonic Balance inspection with scalar nonlinear metrics, solver convergence, stored device parameters and on-demand retained arrays from `saved_data/nonlinear.h5`.
- Added Harmonic Balance amplitude-response plots for persisted `performance` and `delta_quantity` versus a selected source amplitude while all other source coordinates are fixed explicitly.
- Added an explicit Harmonic Balance saved-data X-axis selector: any retained array from the selected point can drive compatible traces without interpolation, while automatic stored frequency/index remains the default.
- Added a project-wide run manager that can select and delete multiple stored runs with one confirmation while protecting the currently active simulation.
- Normalized Harmonic Balance Results against Linear Results: metric-first controls, matching selected-configuration/scalar-metric/retained-array wording and number formatting, compatible saved arrays overlaid in the same plot, and `Show stored configurations` support.
- Moved multi-run management out of the vertical Results flow: `Manage runs` now sits beside the compact stored-run count and opens a modal only when needed.
- Fixed the normalized Harmonic Balance Results white-screen crash caused by conditional React hook execution while the first selected point was being initialized.
- Clarified Harmonic Balance point inspection so `Selected source configuration` contains only source frequencies/amplitudes, while circuit/device parameters remain visible in a separate block.
- Normalized completed LIN / OPT / HB timestamps to the common `DD/MM/YYYY · HH:MM:SS` display format for both live and stored runs.
