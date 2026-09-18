# AUD_20260911_002 — Installable desktop packages

Date: 2026-09-11
Type: change
Tier: T3
Status: qualified
Work item: `WI_20260911_002_installable_desktop_packages.md`

## Objective
Verify that JCO-GUI can be distributed as OS-specific desktop packages without restructuring or changing the scientific application contract.

## Scope
- build-time staging of the root JCO Julia package;
- Windows NSIS installer and portable targets;
- Linux AppImage target;
- GitHub Actions packaging jobs;
- installed-resource path compatibility.

## Static review performed
- Existing packaged lookup already uses `process.resourcesPath` for `jco`, bridge, templates, and examples.
- Existing `electron-builder.yml` already defines those resources; the missing `runtime/jco` input is now generated from authoritative root JCO files immediately before packaging.
- The staging script checks GUI/JCO version equality before a package is built.
- No React scientific view, `.jco` schema, simulation algorithm, metric semantics, unit conversions, HDF5 transforms, or JCO numerical source is intentionally modified by the packaging layer.

## Validation status
Qualified.

Recorded evidence for the final feature branch:
- GitHub Actions governance check completed successfully on the final PR state.
- GitHub Actions `PR build check` completed successfully on run `34600027238`.
- GitHub Actions `Build Linux AppImage` completed successfully on run `34600027233` and produced the `JCO-GUI-Linux-x64-AppImage` artifact.
- GitHub Actions `Build Windows desktop packages` completed successfully on run `34600027301` and produced the `JCO-GUI-Windows-x64` artifact.
- The GitHub-built Windows artifact was downloaded and manually tested successfully.
- The installed Windows application remained operational with the local repository directory renamed, confirming that packaged startup does not depend on the development checkout.
- Local Windows `npm run package:win` had already completed successfully and generated both Windows package variants.
- Tag-driven release publication was subsequently exercised successfully by `v0.4.0`, which published Windows Setup/Portable and Linux AppImage assets through the release workflow.

Still pending before this audit can be considered complete:
- manual launch/runtime validation of the Linux AppImage on a Linux system;
- an explicitly recorded Julia-backed scientific run from the installed package, if required for release qualification.

Integrated recovery point after merge: `659d2ee` (`659d2ee33fc3208c324f92b4c5aec17d59216ba3`).

## 2026-09-17/18 fresh-runtime follow-up

PR #8 (`Prepare Julia runtime automatically on first launch`) was merged to `main` at `641e12d4b20f0472683d61c40e27e06867c0a361`.

The change keeps Julia external but makes environment preparation automatic and fingerprinted:
- one shared runtime-setup process executes `Pkg.instantiate()` followed by `Pkg.precompile()` when readiness is missing or stale;
- Run, Results/saved-data bridge reads and Circuit Preview wait for the shared setup instead of starting with an incomplete Julia environment;
- the renderer shows a first-start preparation notice while setup is running.

Recorded validation:
- PR #8 governance check: passed;
- PR #8 `PR build check`: passed;
- PR #8 Linux AppImage build: passed;
- PR #8 Windows desktop package build: passed;
- manual source-mode fresh-runtime test used an isolated empty `JULIA_DEPOT_PATH`; Julia installed the General registry and project dependencies (including `HDF5` and `IntervalArithmetic`), completed project precompilation, and subsequent simulation use no longer reproduced the missing-dependency failures.

This follow-up does not change JCO numerical algorithms, metric semantics, source units, `.jco` schema, or stored-result transformations. The audit remains **qualified** because Linux runtime launch and an explicitly recorded Julia-backed scientific run from the installed desktop package remain pending.

## Known limitations
- Julia is not bundled and remains required for Julia-backed operations.
- First Julia setup can require internet access and may take several minutes.
- Initial Windows packages are expected to be unsigned and may trigger SmartScreen/unknown-publisher warnings.
- Linux packaging is x64-only in this first pass.
- macOS distribution is deferred.
