# Changelog

This changelog records completed user-relevant and development-process changes. Git history remains the detailed implementation record.

## Unreleased

### v0.4.3 candidate — Nonlinear feedback GUI (draft PR #24)

- Add optional nonlinear-feedback controls in the Setup computation panel: enable/disable, correction-cycle count, and per-source fixed reference current in amperes, independent from the swept nonlinear pump amplitudes.
- Make `user_nonlinear_correction(S_linear, sol, device_params_set)` discoverable from the Metrics editor. The third argument of `user_cost` continues to receive the correction; no numerical scientific definition is changed by the GUI.
- Store cycles and reference currents in the existing `.jco` input keys; default feedback to off (0 cycles) for new projects and validate numeric source values when enabled.
- Add renderer/serialization regression tests. Real multi-cycle Julia harmonic-balance runs and scientific correction behavior remain to be validated before a v0.4.3 release.

## 0.4.2 - 2026-10-30

[Complete release notes](docs/releases/v0.4.2.md) · Windows installer/portable and Linux AppImage are published by the tag-driven GitHub Actions workflow.

### GUI and maintenance updates since 0.4.1

This release collects the integrated October 2026 GUI improvements and maintenance updates. Nonlinear-feedback UI changes under draft PR #24 are **not** included.

### October 2026 — JCO visual identity
- Adopt the JCO Josephson-junction logo in the desktop application's About dialog and repository README; replace the placeholder lightning-bolt header icon with the final JCO icon.
- Add vector branding assets under `docs/images/` and `gui/public/`, use the icon as the GUI favicon, and configure Electron Builder to generate Windows/Linux application icons from the SVG master in `gui/build/`.
- Match the application header to the logo's deep navy, preserving the existing functional light/dark palettes and scientific workflows.
- Add a multi-resolution Windows ICO and PNG generated from the SVG master for native desktop window/taskbar branding, and embed the Windows ICO in packaged executables. Keep the pre-existing SVG source for Linux packaging.

### October 2026 — Run lifecycle and Results usability
- Remove a newly finished run automatically only if its output directory contains no known or potential numerical results, user-saved data or optimizer history; preserve partial/uncertain runs and repair the latest-run pointer.
- Display HB source amplitudes using the **per-source units from each run's original input** (A or dBm) without a global Results toggle, retaining dBm/50 Ω as a backward-compatible display convention for older runs without snapshots.
- Open a single dragged-and-dropped `.jco` file from any GUI screen using the normal validated project loader, with warnings for unsaved changes and active-run protection.
- Keep Fixed, Range and List parameter fields editable after importing a `.jco`; switching modes clears obsolete values (including Range stop/step) rather than leaving disabled fields populated. Serialize early drag-and-drop opening with startup initialization and clear the drop overlay on all exit paths, with interactive regression tests.

### October 2026 — GUI usability, results and display
- Export the currently plotted CSV traces consistently in Linear and Harmonic Balance, for single configuration and A/B overlays; preserve original Hz samples, the chosen real/imaginary/magnitude/phase component, and separate labeled columns for A/B without interpolation.
- Extend plotted CSV export to Linear one-parameter metric curves and HB amplitude-response charts, preserving their displayed axis units.
- Put the README's JCO branding logo after the scientific content and reference information and center Workspace navigation icons in their column.
- Remove the global floating Run remaining action and restore a navigation-only Setup footer; retain Run/Stop controls exclusively within the Run screen.
- Show a lightweight five-second completion notification for finished, failed or cancelled desktop simulations, with no persistent cross-screen status bar.
- Add Julia syntax colors, line numbers, synchronized scrolling, and Tab/Shift+Tab four-space indentation (including selected lines) to all four editable Setup code dialogs while preserving the exact project source; no new dependencies (Issue #4).
- Replace the Setup AC/DC source selector with exclusive buttons and retain the previous AC frequency only during GUI editing; export DC frequency as zero without persisting temporary AC history (PR #15).
- Fix duplicate desktop scrolling and explain the shared intermodulation limit needed for first-order Linear-stage harmonic settings, without changing solver defaults (PRs #15–16).
- Add two-point A/B comparison for Linear and Harmonic Balance landscapes, including compact parameter/metric differences and on-demand overlays of matching retained arrays without hidden X-axis resampling (PR #17).
- Add native desktop zoom at 50–150% with shortcuts and preference persistence, bounded heatmap Y-cell height, and Light/Dark/System themes (PR #18).

### October 2026 — Development traceability
- Add a PR documentation checklist and automatic GitHub Governance check for changelog, ADR, audit/work item, repository status and agent instructions, allowing explained "not needed" decisions for routine changes.
- Reconcile the historical GUI PR #15–18 record in a qualified retrospective audit and refresh the repository recovery status.

### Julia dependencies and Windows compatibility
- Defer legacy Julia plotting initialization until requested and avoid constructing
  discarded figures in GUI runs, including nonlinear-feedback convergence plots.
- Remove seven unreferenced direct Julia dependencies, keeping the numerical
  solver, HDF5 storage, and optional Julia plotting packages intact.
- Remove the generic `JCO.plot` / `JCO.mplot` aliases; use `Plots.plot` /
  `GLMakie.plot` explicitly in Julia scripts. Preserve JCO's lazy diagnostic
  plotting helpers and fix world-age/name collisions.
- Document Smart App Control DLL blocks and the security trade-off of disabling it.

## 0.4.1 - 2026-09-18

### Application
- Prepare the bundled Julia environment automatically on first desktop launch, and again only when the configured Julia executable or bundled `Project.toml` / `Manifest.toml` changes.
- Share one runtime-setup operation across Run, Results, saved-data reads, and Circuit Preview so Julia-backed actions wait for readiness instead of failing on missing packages.
- Keep the GUI available while Julia packages are instantiated and precompiled, with a visible first-start preparation banner.

### Packaging
- Fix fresh installations that could fail with missing Julia dependencies such as `HDF5` or `IntervalArithmetic`.
- Reuse the runtime fingerprint/readiness state after successful setup so normal subsequent launches do not repeat `Pkg.instantiate()` / `Pkg.precompile()`.

## 0.4.0 - 2026-09-11

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
- Add tag-driven GitHub Releases that publish Windows installer/portable artifacts and the Linux AppImage.
- Make packaged desktop downloads the recommended README installation path while retaining source launchers for developers.
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
