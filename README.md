# JosephsonCircuitsOptimizer.jl (JCO)

**JosephsonCircuitsOptimizer.jl (JCO)** is a Julia framework for the automated exploration and optimization of superconducting Josephson circuits. It is built on [JosephsonCircuits.jl](https://josephsoncircuits.org/), which performs the circuit simulations, while JCO organizes them into a structured workflow for parameter exploration, optimization, and nonlinear analysis.

JCO combines three levels of analysis:

1. a computationally efficient **linear design-space exploration**;
2. a **surrogate-based optimization** that refines the most promising device parameters;
3. a **nonlinear harmonic-balance analysis** of the selected design over its physical working points.

The project includes a desktop GUI for defining `.jco` experiments, running the simulation stages, and exploring stored results.

> **Version 0.3.0** introduces the integrated desktop architecture, project-based `.jco` workflow, stage-aware execution and reuse, structured Results views, retained-array persistence, and preliminary Linux launcher support.

## Documentation

The complete user documentation is available here:

**[JCO User Manual (PDF)](docs/JCO_Documentation.pdf)**

The manual covers:

- the JCO workflow and its relationship with JosephsonCircuits.jl;
- Windows and Linux startup;
- `.jco` project structure and stored results;
- the **Setup**, **Run**, and **Results** GUI sections;
- circuit, device-parameter, source, solver, and optimizer configuration;
- `user_cost`, `user_performance`, masks, nonlinear feedback, and `save_data`;
- parametric sources and project-contained calibration files.

Developer and contributor documentation is kept separately in the repository (`AGENTS.md`, `adr/`, `audits/`, `docs/`, and `governance/`).

## Quick start

### Requirements

- **Julia** must be installed to preview circuits or run simulations.
- Node.js/npm do **not** need to be installed globally when using the desktop launchers; the GUI runtime is prepared locally on first launch.
- An internet connection may be required on first use to prepare the GUI runtime and instantiate Julia dependencies.

### Windows

From the repository root, double-click:

```text
START_JCO_GUI.bat
```

or run it from PowerShell:

```powershell
.\START_JCO_GUI.bat
```

In the GUI, open **Settings** to select the Julia executable and the desired number of Julia threads. Use the runtime-setup action on first use if the Julia environment still needs to be instantiated/precompiled.

### Linux

From the repository root:

```bash
chmod +x START_JCO_GUI.sh
./START_JCO_GUI.sh
```

> **Linux support is preliminary.** The Linux launcher is provided for x86-64 and ARM64/aarch64 systems, but Linux has been less extensively validated than Windows and may require distribution-specific Electron/system libraries.

## Running directly from Julia

Activate the local environment:

```julia
using Pkg
Pkg.activate(".")
```

Run the complete workflow:

```julia
import JosephsonCircuitsOptimizer as JCO
JCO.run()
```

To use a custom workspace:

```julia
JCO.run(workspace=raw"C:\...\my_experiment_01")
```

When Julia is started manually, the number of threads can be selected from the terminal, for example:

```bash
julia --threads 12
```

and checked inside Julia with:

```julia
Threads.nthreads()
```

## The `.jco` project

A JCO experiment can be stored as a single `.jco` file. The file is a versioned ZIP container that keeps the editable experiment definition together with its retained simulation runs and numerical results.

A project contains the circuit definition, device-parameter space, sources, simulation/optimizer settings, cost and performance functions, optional helper/calibration files, and the outputs produced by each run.

The GUI is organized around three main areas:

- **Setup** — define the circuit, parameters, sources, computation settings, metrics, and constraints;
- **Run** — execute Linear, Optimization, and Harmonic Balance stages using **Run all**, **Run remaining**, or a selected stage;
- **Results** — inspect stored Linear, Optimization, and Harmonic Balance results, saved arrays, run snapshots, and run history.

See the [User Manual](docs/JCO_Documentation.pdf) for the full project format and experiment syntax.

## Scientific workflow

The Linear stage explores the device-parameter space using a user-defined metric \(\mathcal{M}\). The Optimization stage refines the most promising region using a surrogate-based search. The selected device is then evaluated in the nonlinear regime over its physical working points through a user-defined performance function \(\mathcal{F}\).

Optional nonlinear feedback can use information obtained from the nonlinear solution to modify the following linear optimization cycle.

The circuit simulations themselves are performed by [JosephsonCircuits.jl](https://josephsoncircuits.org/).

## Tests

GUI tests and build:

```bash
cd gui
npm test
npm run build
```

## Citation

If you use JCO in scientific work, please cite:

> E. Palumbo *et al.*, **“JosephsonCircuitsOptimizer.jl (JCO)”**, *IEEE Transactions on Applied Superconductivity* (2026).  
> DOI: [10.1109/TASC.2026.3679488](https://doi.org/10.1109/TASC.2026.3679488)

Repository:

https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer

## License

JosephsonCircuitsOptimizer.jl is released under the [MIT License](LICENSE.md).
