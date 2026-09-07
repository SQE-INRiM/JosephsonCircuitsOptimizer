# WI_20260901_004 — HB configuration and timestamp consistency

## Goal
Refine Results and Run terminology without changing numerical or storage semantics.

## Scope
- In Harmonic Balance point inspection, define the selected configuration only by stored source frequency/amplitude coordinates.
- Keep persisted device parameters visible in a separate block because they describe the circuit used at that point.
- Normalize LIN / OPT / HB completion timestamps to one display format regardless of whether they came from a live backend event or a stored run ID.
- Add targeted formatter coverage and run the existing PR test/build checks.

## Acceptance criteria
- `Selected source configuration` contains only `source_i_frequency` / `source_i_amplitude` values.
- Device parameters remain visible under a separate `Device parameters` heading.
- All completed stage cards use `DD/MM/YYYY · HH:MM:SS` when a timestamp can be recognized.
- Existing scientific data, stage execution and `.jco` schema remain unchanged.
