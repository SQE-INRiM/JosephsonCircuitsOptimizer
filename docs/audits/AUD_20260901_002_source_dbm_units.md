# AUD_20260901_002 — Source amplitudes in A or dBm

Status: **qualified**

## Scope

Review of `WI_20260901_002` / `ADR_004` on branch `feat/setup-source-dbm`.

## Findings

- The GUI source model now supports independent `A` / `dBm` display units for Linear and Nonlinear amplitudes and a per-source reference impedance, defaulting to 50 Ω.
- The implemented conversion matches the maintainer-supplied convention: `P = 2|Ip|^2 Z0` and `Ip = sqrt(P/(2 Z0))`.
- `drive_physical_quantities.json` remains canonical in Ampere; no dBm-specific keys are added to JCO simulation inputs.
- A dBm Range is expanded in dBm and converted point-by-point to an explicit Ampere list. This avoids incorrectly treating the converted currents as uniformly spaced in A.
- `-Inf dBm` maps to `0 A` for explicit off-state points.
- GUI display-unit choices and original display-space amplitude specs are persisted in root-level `jco_gui_metadata.json`, which is packed into `.jco` but is outside `user_inputs`.
- Existing workspaces without that metadata load as Ampere with `Z0 = 50 Ω`.
- Frontend conversion utilities include tests for the 50 Ω reference conversion, off-state handling, and dBm range point preservation.
- The HB Results section now has a display-only A/dBm selector. In dBm mode a derived copy of the nonlinear result table converts source amplitude coordinates with the source-specific `Z0`; the stored results bundle/HDF5 values remain unchanged in Ampere.
- The HB dBm display conversion applies across the existing landscape, fixed-coordinate selectors, selected-point source coordinates, stored configuration table and amplitude-response plots because those views consume the same derived table.
- Tests cover A passthrough, the `1 µA @ 50 Ω = -70 dBm` reference point and source-specific impedance behavior.

## Qualification / remaining validation

This audit does not claim a local Node/Vite build or end-to-end desktop run. Before merge:

1. run `npm test` and `npm run build` locally;
2. open a project, set an HB amplitude such as `-90:-5:-80 dBm`, save/run, and inspect `drive_physical_quantities.json` in the active workspace to confirm it contains the three individually converted Ampere values;
3. save and reopen the `.jco` and confirm the GUI restores dBm, the original dBm values, and `Z0`;
4. confirm an existing Ampere-only `.jco` opens unchanged;
5. inspect HB Results in both A and dBm modes and confirm finite source-amplitude coordinates are numerically equivalent;
6. note that an exact `0 A` coordinate is `-Inf dBm`. The current HB plotting/filtering code requires finite numeric coordinates, so an off-state point cannot yet be plotted faithfully on a numeric dBm axis. No arbitrary finite dBm floor is substituted; this remains an explicit UI limitation to resolve before claiming complete off-state visualization support.

The branch should remain unmerged until these local checks pass.
