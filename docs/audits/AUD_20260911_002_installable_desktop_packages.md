# AUD_20260911_002 — Installable desktop packages

Date: 2026-09-11
Type: change
Tier: T3
Status: in_progress
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
In progress. Do not mark complete until package artifacts are actually built and launched.

Pending evidence:
- `npm test`;
- `npm run build`;
- Windows `npm run package:win`;
- Windows installer install / launch / uninstall;
- installed-app Julia setup and one small JCO run;
- Linux GitHub Actions AppImage build;
- Linux AppImage launch when a Linux validation environment is available.

## Known limitations
- Julia is not bundled and remains required for Julia-backed operations.
- First Julia setup can require internet access and may take several minutes.
- Initial Windows packages are expected to be unsigned and may trigger SmartScreen/unknown-publisher warnings.
- Linux packaging is x64-only in this first pass.
- macOS distribution is deferred.
