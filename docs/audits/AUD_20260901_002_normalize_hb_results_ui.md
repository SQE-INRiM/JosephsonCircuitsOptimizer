# AUD_20260901_002 — Normalize Harmonic Balance Results UI

Status: qualified
Tier: T2

## Scope
- Align HB Results control order, labels, selected-point presentation and retained-array plotting with Linear Results.
- Add stored-configuration table for HB.
- Move multi-run management into a compact modal opened from the stored-runs header.

## Scientific review
- HB source coordinates, scalar metrics, convergence values and point IDs are read without transformation.
- Exact fixed-coordinate slicing is preserved.
- Multiple retained arrays are overlaid only when they share a compatible canonical X axis or have the same length as the explicitly selected retained X vector.
- No interpolation, averaging, power conversion, numerical solver change, HDF5 schema change or `.jco` schema change is introduced.

## Automated verification
Pending PR CI: `npm test` and `npm run build`.

## Remaining validation
Manual Windows/Electron review with a real multi-source HB run remains recommended for visual parity and interaction ergonomics.
