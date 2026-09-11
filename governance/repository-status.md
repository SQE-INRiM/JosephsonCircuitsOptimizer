# Repository Status

Last governance refresh: 2026-09-11

## Current development baseline

- Repository: `SQE-INRiM/JosephsonCircuitsOptimizer`
- Primary branch: `main`
- Application stack: Julia/JCO package at repository root with the Electron/React GUI under `gui/`.
- Unified-repository migration was merged by PR #1 on 2026-09-07 at `8e148a2`.
- Preliminary Linux launcher was merged by PR #2 at `75dfe0b`.
- Release `v0.3.0` was merged by PR #3 at `497ceb1` on 2026-09-08, followed by README/image refinements through `6e9ab98`.
- Circuit Preview / fresh-install runtime hardening is integrated through `399873f`.
- Example-project lifecycle and background Circuit Preview work is integrated through implementation `aac3931` plus governance follow-up through `9ac91fd`.
- Installable desktop packaging from PR #6 is integrated in `main`; current recovery point is `659d2ee`.

## Integrated functional state

The unified GUI provides:
- Setup for circuit code, device parameters, sources, computation settings and metric code;
- explicit JCO-resolved Circuit Preview with stale-state tracking and background generation;
- neutral `New project` startup and dynamically discovered bundled `.jco` examples;
- direct execution of bundled examples in isolated temporary sessions while ordinary unsaved projects retain the Save As guard;
- Linear, Optimization and Harmonic Balance execution through the Julia bridge;
- persistent `.jco` project/result storage and Results exploration.

Desktop distribution now provides:
- Windows x64 NSIS installer;
- Windows x64 portable executable;
- Linux x64 AppImage;
- build-time staging of the authoritative root JCO Julia package into packaged Electron resources;
- GitHub Actions generation of Windows/Linux artifacts on pull requests and `main`;
- tag-driven release workflow for publishing desktop artifacts to GitHub Releases;
- Julia remains an external runtime requirement.

No packaging change intentionally modifies JCO numerical algorithms, scientific metric semantics, source units, persistent `.jco` schema, or the renderer/Julia scientific contract.

## Packaging validation state

PR #6 final CI evidence:
- governance check: passed;
- PR test/build check: passed;
- Linux AppImage build: passed and artifact produced;
- Windows desktop package build: passed and artifact produced.

Windows manual evidence:
- GitHub-built Windows artifact downloaded successfully;
- packaged Windows application tested successfully;
- installed application remained operational after renaming the local repository directory.

The packaging audit remains **qualified**, not complete, because Linux runtime launch and tag-driven release publication have not yet been recorded, and no installed-package scientific run is claimed unless separately documented.

See `docs/audits/AUD_20260911_002_installable_desktop_packages.md`.

## Governance state

Governance remains lightweight and advisory:
- `AGENTS.md` is the coding-agent entry point;
- ADR 007 remains authoritative for Circuit Preview execution/topology boundaries;
- `WI_20260911_001_example_project_workflow.md` / `AUD_20260911_001_example_project_workflow.md` retain the example/background-preview record;
- `WI_20260911_002_installable_desktop_packages.md` / `AUD_20260911_002_installable_desktop_packages.md` track the T3 packaging change;
- `CHANGELOG.md` keeps desktop-packaging work under `Unreleased` until a new version is published.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next safe action

1. Update the user manual source/PDF with the installer-first workflow once the manual source is available.
2. Optionally validate the Linux AppImage on a real Linux system.
3. Select the next release version, update version/changelog files as needed, then create the matching `v*` tag.
4. Record only checks actually performed; do not upgrade the packaging audit to complete until its remaining evidence is available.
