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
- Maintain the .jco project schema, save/open behavior, runtime settings and scientific simulations unchanged.

## Tests and verification

- React/jsdom: verify menu content and order with a mocked example, Save As wiring and Dark/Light selection.
- Theme tests: verify first-launch Dark default, old System migration and explicit Light preservation.
- GitHub Actions PR test/build, Windows/Linux packaging and governance checks; manual Windows GUI inspection remains the user's acceptance step.

## Documentation decisions

- Changelog updated in `CHANGELOG.md`.
- No ADR required: no architecture or .jco persistence changes.
- No agent instruction changes or repository-status update before integration into main.
