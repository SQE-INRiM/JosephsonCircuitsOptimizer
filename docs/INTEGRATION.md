# Connected desktop architecture

The application is split so the React renderer cannot access arbitrary files or launch processes directly.

| Layer | Responsibility |
|---|---|
| React renderer | Setup forms, stage controls, logs, result selection, charts |
| Electron preload | Narrow typed `JcoAdapter` exposed through `contextBridge` |
| Electron main | Dialogs, `.jco` archive lifecycle, temporary workspace, Julia process, cancellation, CSV export |
| Julia bridge | Call the supplied JCO public API and convert current HDF5/JSON results into renderer-safe JSON |
| JCO library | Simulation, optimization, nonlinear analysis, native output files |

The renderer contract is `src/services/jcoAdapter.ts`. Main/preload implementations are in `desktop/`; Julia entry points are in `runtime/bridge/`.

## Project lifecycle

```text
legacy folder ──Import──┐
                       ├──> private workspace ──Save/auto-save──> project.jco
project.jco ───Open────┘            │
                                    ├──> JCO simulation
                                    └──> results.jl ──> charts / CSV
```

Valid `.jco` files placed in `gui/runtime/examples/` are discovered automatically when the project menu is opened. Examples are unpacked into isolated temporary workspaces, so the shipped files cannot be overwritten accidentally. They can be simulated without Save As; changes and generated results become durable only if the user explicitly saves the example as a project.

Packaged desktop builds include the examples present at build time, so adding an example to a released application requires rebuilding the package.

## Julia execution

`Save & setup` runs `Pkg.instantiate()` and `Pkg.precompile()` in the bundled JCO environment. Simulations then invoke the matching JCO function according to selected stages:

| Selected stages | Mode |
|---|---|
| Linear only | `run_sweep_only` |
| Optimization only | `run_optimization_only` |
| HB only | `run_nonlinear_only` |
| Optimization + HB | `run_from_latest_dataset_only` |
| Other combinations | `run` |

The main process parses the library's existing `STAGE name=...` and `PROGRESS ...` stdout lines and forwards typed events to the renderer. Cancellation first writes the supported `STOP` sentinel and then terminates the process after a bounded timeout.

## Results

`runtime/bridge/results.jl` indexes each `outputs/output_*` directory and reads:

- linear `df_matrix`, filtered matrix, and column names;
- nonlinear matrix, converging rows, and column names;
- run/status/config/optimal-parameter JSON metadata;
- retained HDF5 traces, downsampled for interactive display.

Views choose axes and metrics from actual column names rather than assuming one circuit. Optimization correlation is computed in the renderer from numeric dataset columns. HB selects the nonlinear table.

## Extension points

- Add structured editors for correction/loss source fields currently preserved but editable as JSON/code.
- Add column/range filters to `ExportRequest`; the main process already owns export and can apply them safely.
- Replace stdout parsing with versioned JSONL events in the library when its public logging protocol can change.
- Add schema adapters when historical output column conventions differ.
- Add a packaged Julia runtime only after licensing, size, and update policy are decided; the current build uses a system Julia installation.
