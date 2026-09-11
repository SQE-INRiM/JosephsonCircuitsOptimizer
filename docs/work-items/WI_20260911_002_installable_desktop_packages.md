# WI_20260911_002 — Installable desktop packages

## Classification
T3 — release/distribution-critical workflow. The change packages the existing GUI and JCO runtime for end users but does not intentionally change scientific calculations, `.jco` schema, units, metrics, or simulation-stage semantics.

## Goal
Provide normal desktop distribution artifacts without requiring users to clone the repository or install Node.js/npm:
- Windows x64 NSIS installer;
- Windows x64 portable executable;
- Linux x64 AppImage.

Julia remains an external runtime requirement.

## Architecture constraint
Packaging must remain a thin layer around the existing application:
- do not move or duplicate the authoritative root `src/` tree in Git;
- do not change the React/JCO bridge contract merely for packaging;
- generate `gui/runtime/jco/` only as a build-time staging directory;
- package the root `Project.toml`, `Manifest.toml`, `src/`, and license into `resources/jco`;
- keep bridge/templates/examples as the existing Electron extra resources;
- retain `app.isPackaged` resource lookup as the installed-app boundary.

## Acceptance criteria
- `npm test` passes before packaging.
- `npm run package:win` produces both Setup and Portable `.exe` files on Windows.
- The Windows installer installs/uninstalls as a per-user application and creates normal launch shortcuts.
- Installed Windows application opens without Node.js/npm or a repository checkout.
- Installed application resolves bundled templates/examples and the packaged JCO source tree.
- Julia Settings can point to a working Julia executable and the runtime can instantiate/load the packaged JCO environment.
- `npm run package:linux` / GitHub Actions produces an x64 AppImage.
- Linux AppImage launches without a repository checkout or Node.js/npm.
- Opening an app/package does not execute arbitrary user Julia; existing explicit preview/run boundaries remain unchanged.
- A normal `.jco` project can be opened/saved and a small scientific run can complete from the installed Windows build.

## Release-safety checks
- GUI `package.json` version must match root `Project.toml`; packaging fails otherwise.
- Generated staging directory is ignored by Git and rebuilt from authoritative root sources for every package.
- No claim of cross-platform scientific validation is made until the corresponding packaged artifact has actually been exercised.

## Non-goals
- Bundling the Julia executable itself.
- macOS signing/notarization.
- Automatic application updates.
- Code signing of the first Windows research build.
- Changing JCO numerical behavior.
