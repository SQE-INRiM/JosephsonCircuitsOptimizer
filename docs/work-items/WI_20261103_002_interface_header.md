# WI 20261103 002 — Unify project title in the GUI header

**Status:** proposed implementation on `gui/interface-polish`, pending user visual review
**Risk tier:** T2 — user-visible GUI layout and project-name editing

## Requested behavior

- In the application header, show a single clickable project display name.
- Hide the underlying `.jco` filename; preserve it internally for Open, Save and Save As.
- Remove the duplicate `Project name` field from the Setup page.
- Remove the developer-facing `Desktop bridge` and `Schema v1` header badges, plus the redundant schema label from Setup's status footer.
- Do not alter Julia execution, scientific configuration, `.jco` persistence or the three-dot menu (to be refined separately).

## Design and acceptance criteria

- Clicking the project name opens an inline text editor in the header on every screen.
- Enter or focus loss commits a nonempty name and marks the project unsaved; Escape cancels without changing anything.
- An empty edit is ignored. An unsaved new project continues to derive its proposed `.jco` filename from the edited display name; a project with an existing filesystem path retains its actual filename.
- Loading a different project updates the displayed title.
- The filename remains stored but is never shown in the header, and Setup has no duplicate project-name field.

## Verification

- Added targeted React/Vitest tests for title display, rename/filename persistence, Escape and blank names.
- Pending: GitHub Actions tests, renderer build, Windows/Linux packaging and manual visual review in the Windows desktop GUI.

## Impact

Presentation-only. No architecture decision record or schema migration required.
