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

Evidence reported by the maintainer on Windows:
- `npm run package:win` completed successfully;
- the renderer production build completed successfully as part of that command;
- build-time JCO staging completed successfully;
- both `JCO-GUI-0.3.0-Windows-Setup.exe` and `JCO-GUI-0.3.0-Windows-Portable.exe` were generated;
- the packaged Windows application/installer was manually exercised and reported to work correctly.

Still pending before this audit can be considered complete:
- a separately recorded `npm test` result for this final branch state;
- installed-app Julia setup and one small JCO scientific run;
- Linux GitHub Actions AppImage build;
- Linux AppImage launch when a Linux validation environment is available;
- tag-driven GitHub Release publication after the feature is merged and a release version is selected.

## Known limitations
- Julia is not bundled and remains required for Julia-backed operations.
- First Julia setup can require internet access and may take several minutes.
- Initial Windows packages are expected to be unsigned and may trigger SmartScreen/unknown-publisher warnings.
- Linux packaging is x64-only in this first pass.
- macOS distribution is deferred.
