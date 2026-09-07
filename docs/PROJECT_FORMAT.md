# `.jco` project format (`jco.project/1`)

The connected GUI uses a **versioned ZIP container with a `.jco` extension**. This is intentionally a compatibility container, not a replacement for the current JCO workspace or its HDF5 output schema.

```text
example.jco
├── manifest.json
└── workspace/
    ├── user_inputs/
    │   ├── device_parameters_space.json
    │   ├── drive_physical_quantities.json
    │   ├── optimizer_config.json
    │   ├── simulation_config.json
    │   ├── user_circuit.jl
    │   ├── user_cost_and_performance.jl
    │   └── ...optional helpers and auxiliary files
    └── outputs/
        └── output_<run-id>/
            ├── df_uniform_analysis.h5
            ├── df_nonlinear_analysis.h5       # when HB was run
            ├── saved_data/
            │   ├── linear.h5                  # only arrays selected with save_datas
            │   ├── nonlinear.h5               # only arrays selected with save_datas
            │   └── custom.h5                  # optional point-addressed custom arrays
            ├── linear_traces.h5               # diagnostic mode "all" only
            ├── nonlinear_traces.h5            # diagnostic mode "all" only
            ├── optimal_device_parameters.json
            ├── optimal_physical_quantities.json
            └── simulation_info/
```

`manifest.json` contains the format identifier, project UUID, display name, compatibility field, and creation/modification timestamps. Paths such as `.git`, `node_modules`, `__pycache__`, and notebook checkpoints are excluded.

## Why ZIP instead of one new HDF5 schema

The current library already consumes a directory containing arbitrary JSON, Julia code, auxiliary curves, and HDF5 results. A ZIP container gives the user one portable file while preserving every input and the existing result schema byte-for-byte. It also avoids forcing the solver and historical projects through a risky storage rewrite.

The GUI extracts the archive to its private application-data workspace, modifies files there, and packs it back atomically. A future major format may define a normalized HDF5-only schema after the JCO result model is stable.

## Numerical result contract

The GUI separates low-cost scalar summaries from potentially expensive frequency-resolved arrays.

### Summary tables: always stored

- `df_uniform_analysis.h5` is the Linear summary table. Every row now includes a stable numeric `point_id` in addition to device parameters and configured scalar metrics.
- `df_nonlinear_analysis.h5` is the HB summary table. Every row includes the corresponding stable `point_id`, source frequencies/amplitudes, convergence and configured scalar performance metrics.
- The `point_id` is the canonical link between a summary-table row and any detailed arrays retained for that same simulation configuration. Results code must use this ID rather than comparing floating-point parameter values.

### Selected arrays: default

`trace_storage_mode = "selected"` is the default GUI policy. The runtime does **not** retain every S-parameter matrix. Instead, calls to `save_datas(...)` made while a Linear or nonlinear summary point is executing are written directly to:

- `saved_data/linear.h5`
- `saved_data/nonlinear.h5`
- `saved_data/custom.h5` when the user explicitly chooses the `custom` category

Each file uses schema `jco.saved-data/1` and contains groups such as:

```text
point_000037/
├── point_id
├── parameter_names
├── parameter_values
├── source_frequencies_hz      # nonlinear points when applicable
├── source_amplitudes_a        # nonlinear points when applicable
└── S21/
    ├── quantity_name
    ├── prefix
    └── S21/
        ├── storage
        ├── real
        └── imag
```

A common `frequency_hz` axis is stored at the HDF5 root when the simulation uses the standard JCO frequency grid. Real arrays are stored as `values`; complex arrays are stored as matching `real` and `imag` datasets.

This means the Results UI can select a row from `df_uniform_analysis.h5`, read its `point_id`, discover which detailed quantities exist for that point, and plot (for example) a saved `S21(f)` underneath the summary matrix. A point is valid even when no detailed arrays were saved for it.

Calls to `save_datas(category="linear"|"nonlinear")` made outside an active summary-table point—for example during optimizer-only surrogate evaluations—are intentionally not attached to Linear/HB point IDs. This prevents optimizer samples from being mistaken for rows of the uniform or nonlinear DataFrames.

### Diagnostic full-trace mode

`trace_storage_mode = "all"` is an explicit diagnostic option in `simulation_config.json`. In this mode the selected `save_datas` outputs are still written, and the GUI additionally retains the full fundamental S-parameter matrix for every applicable point in `linear_traces.h5` / `nonlinear_traces.h5`.

`trace_storage_mode = "none"` disables detailed-array persistence while keeping the summary HDF5 tables and bookkeeping.

The diagnostic trace files do **not** serialize the complete JosephsonCircuits solver object.

## Behaviour

- **Open** validates the manifest and required input set, then extracts safely.
- **Import legacy folder** accepts either a direct workspace or one wrapper directory and creates an unsaved project.
- **Save** writes a temporary sibling archive and renames it only after packing succeeds.
- **Save As** creates the selected `.jco`; unknown auxiliary files are preserved.
- **Run** requires the project to have been saved once, operates on the extracted
  workspace, and repacks the new output automatically when the process finishes.
  This prevents a scientific result from existing only in a temporary session.
- The run ID displayed by the GUI is the exact output-folder name used by Julia.
- A project may contain multiple immutable run folders; a new run does not overwrite an earlier one.
- GUI-launched runs store numerical HDF5 data and metadata rather than automatically persisting correlation, heatmap or performance PNG files. Visualizations are derived later from the stored numerical datasets.
- Historical `.jco` runs without `point_id` or with the older `data_saved_by_user/` layout remain valid and are not rewritten.
- **Export CSV** is separate from project saving and never stores chart images.

Archive entries are checked against absolute paths and parent-directory traversal before extraction. Opening a project does not execute its Julia code.

## Required inputs

- `device_parameters_space.json`
- `drive_physical_quantities.json`
- `optimizer_config.json`
- `simulation_config.json`
- `user_circuit.jl`
- `user_cost_and_performance.jl`

Optional files such as `user_metric_utils.jl`, `user_parametric_sources.jl`, measurement data, snapshots, and existing output files are retained.
