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

Still pending before this audit can be considered complete:
- manual launch/runtime validation of the Linux AppImage on a Linux system;
- tag-driven GitHub Release publication after the release version is selected;
- an explicitly recorded Julia-backed scientific run from the installed package, if required for release qualification.

Integrated recovery point after merge: `659d2ee` (`659d2ee33fc3208c324f92b4c5aec17d59216ba3`).

## Known limitations
- Julia is not bundled and remains required for Julia-backed operations.
- First Julia setup can require internet access and may take several minutes.
- Initial Windows packages are expected to be unsigned and may trigger SmartScreen/unknown-publisher warnings.
- Linux packaging is x64-only in this first pass.
- macOS distribution is deferred.
