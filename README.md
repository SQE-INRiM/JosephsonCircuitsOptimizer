# JosephsonCircuitsOptimizer.jl (JCO)

**JosephsonCircuitsOptimizer.jl (JCO)** is a Julia framework for the automated exploration and optimization of superconducting Josephson circuits, built on [JosephsonCircuits.jl](https://josephsoncircuits.org/).

JCO combines three main stages:

1. **Linear exploration** of the device-parameter space;
2. **Surrogate-based optimization** of promising configurations;
3. **Nonlinear harmonic-balance analysis** of selected devices and working points.

Optional nonlinear feedback can use the pumped response to refine subsequent optimization cycles.

<p align="center">
  <img src="docs/images/jco_workflow.png" alt="JCO workflow" width="500">
</p>

JCO includes a desktop GUI and portable `.jco` project files for saving and sharing complete experiments.

## Documentation

The **[JCO User Manual (PDF)](docs/JCO_Documentation.pdf)** is the complete reference for the GUI, simulations, optimization, nonlinear feedback, project format, custom Julia functions, and results.

*The manual is being updated for **v0.5.0**. The latest published installer may not yet include all features described in the current repository.*

## Quick Start

**Requirements:** Windows or Linux and a working Julia installation.

Download the latest desktop application from **[JCO-GUI Releases](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/releases/latest)**.

- **Windows:** Run `JCO-GUI-<version>-Windows-Setup.exe` to install JCO, or use `JCO-GUI-<version>-Windows-Portable.exe` without installation.
- **Linux:** Download `JCO-GUI-<version>-Linux-x64.AppImage`, then make it executable and launch it:

  ```bash
  chmod +x JCO-GUI-<version>-Linux-x64.AppImage
  ./JCO-GUI-<version>-Linux-x64.AppImage
  ```

> **Linux packaged support is currently x86-64 and preliminary.** Linux has been less extensively validated than Windows and may still depend on distribution-specific system libraries.

<details>
<summary>⚠️ If Windows blocks installation or simulation</summary>

Windows may warn about the **unsigned JCO installer** (SmartScreen). Separately, Windows 11 **Smart App Control** may block native DLLs required by **Julia**, such as HDF5.

**This is a Windows–Julia compatibility issue, not a JCO bug.**

If you encounter blocked DLLs or error `0xc0e90002`, see [Microsoft's Smart App Control FAQ](https://support.microsoft.com/en-us/windows/smart-app-control-faq-285ea03d-fa88-4a37-8837-aacbe6d2e7d0).

As a workaround, you can disable Smart App Control under **Windows Security → App & browser control → Smart App Control settings**. However, doing so **reduces Windows security** and is not required for all users.

</details>

On first launch, JCO may need an internet connection to prepare its Julia environment. In **Settings**, choose the Julia executable and the desired number of threads.

## The `.jco` Project

A `.jco` file contains everything needed to preserve a JCO experiment: circuit and parameter definitions, simulation settings, custom Julia functions, and saved numerical results.

Projects can be saved, shared, and reopened from the GUI, making it easy to revisit an experiment or continue working on another computer. The full project format is described in the [User Manual](docs/JCO_Documentation.pdf).

## Desktop GUI

The desktop application follows the same scientific workflow through three main areas.

### Setup

<p align="center">
  <img src="docs/images/jco_gui_setup.png" alt="JCO Setup screen" width="800">
</p>

<p align="center"><em>Define the circuit, device parameters, sources, and computation settings, and inspect the resolved lumped-element circuit preview.</em></p>

### Run

<p align="center">
  <img src="docs/images/jco_gui_run.png" alt="JCO Run screen" width="800">
</p>

<p align="center"><em>Execute the Linear, Optimization, and Harmonic Balance stages, with stage status, reuse, cancellation, and simulation logs managed from one view.</em></p>

### Results

<p align="center">
  <img src="docs/images/jco_gui_results.png" alt="JCO Results screen" width="800">
</p>

<p align="center"><em>Explore the sampled design space, selected configurations, scalar metrics, and retained frequency-resolved data.</em></p>

## Citation

If you use JCO in scientific work, please cite:

> E. Palumbo *et al.*, **“JCO: Optimization Framework for Nonlinear Superconducting Circuits Using a Lumped-Element Approach and Harmonic Balance”**, *IEEE Transactions on Applied Superconductivity* (2026).  
> DOI: [10.1109/TASC.2026.3679488](https://doi.org/10.1109/TASC.2026.3679488)

Repository:

https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer

## License

JosephsonCircuitsOptimizer.jl is released under the [MIT License](LICENSE.md).

<p align="center">
  <img src="docs/images/jco-logo.svg" alt="JCO — Josephson Circuits Optimizer" width="320">
</p>

