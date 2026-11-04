# WI 20261104 001 — Simplify the JCO application menu

**Status:** implementation on `gui/menu-refinements`, pending CI and user desktop review
**Risk tier:** T2 — user-visible navigation and persisted UI preference

## Scope and acceptance

- Show project operations at the top of the three-dot menu in this order: New project, Open project, Save, Save As.
- Group bundled examples after a separator, retaining dynamic discovery and direct execution of shipped examples.
- Follow with Julia settings and About JCO, with a final appearance section containing only Dark and Light.
- Remove menu entries for Import legacy folder, Export editable workspace, and Export Data. Preserve their existing desktop bridge implementations for potential future maintenance or restoration; this change intentionally removes the menu access, not internal support.
- Results-area filtered and plotted CSV/data exports are independent and remain accessible there.
- Default to Dark when no preference has been saved, and migrate the removed System value to Dark. Keep an explicitly saved Light or Dark choice across restarts.
- Distinguish Save and Save As for both saved and unsaved projects. Save writes a .jco (prompting for a path on first save). Save As opens a small dialog with primary **Editable workspace (.zip)** using the retained export implementation, and secondary **JCO project (.jco)** to make another .jco copy.
- Exporting a ZIP must not overwrite, rename, or mark the active .jco project saved. Cancelling either export must leave project identity and unsaved state unchanged.
- Expand About JCO while retaining and explicitly centering the JCO logo. Display the package-derived app version, developer **Emanuele Palumbo** as the visual focus, a smaller italic affiliation **INRiM – Politecnico di Torino** (without SQE), and his institutional collaboration email **emanuele.palumbo@polito.it** as an actionable mailto link, plus GitHub repository/issues, IEEE TASC 2026 publication + DOI, a copy-citation action and the MIT license.
- Open these explicitly approved About JCO links in the default system browser via Electron IPC; browser previews use ordinary external links. Do not allow arbitrary URLs via the desktop bridge.
- Eliminate DEP0190 when starting the GUI on Windows by invoking npm's npm-cli.js using the current Node binary with shell disabled; retain portable Node/npm compatibility, the same npm install/build/Electron flow and Julia configuration. Add regression tests for the npm CLI selection.
- Maintain the .jco project schema, save/open behavior, runtime settings and scientific simulations unchanged.

## Tests and verification

- React/jsdom: verify menu content and order with a mocked example, regular Save, both Save As format paths, unchanged .jco/dirty state after ZIP export and Dark/Light selection.
- Theme tests: verify first-launch Dark default, old System migration and explicit Light preservation.
- About tests: verify version, developer attribution, affiliation, DOI, canonical citation copy and external browser bridge.
- Launcher tests: verify npm_execpath and portable npm-cli.js fallbacks, rejecting shell wrappers; run in the existing npm test scripts.
- GitHub Actions PR test/build, Windows/Linux packaging and governance checks; manual Windows GUI inspection remains the user's acceptance step.

## Documentation decisions

- Changelog updated in `CHANGELOG.md`.
- No ADR required: no architecture or .jco persistence changes.
- No agent instruction changes or repository-status update before integration into main.
