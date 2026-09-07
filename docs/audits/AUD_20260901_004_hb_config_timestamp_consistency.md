# AUD_20260901_004 — HB configuration and timestamp consistency

Status: qualified pending PR CI and Windows/Electron visual check.

## Scope
WI_20260901_004.

## Review
- HB selected-point wording now distinguishes source-sweep coordinates from persisted circuit/device parameters.
- No source coordinate, metric, convergence value, retained array or device parameter is removed from Results.
- Completion-time normalization is presentation-only and accepts both live locale timestamps and stored run-ID timestamps.
- No solver, optimizer, HDF5 or project-schema behavior is changed.

## Validation
- Added unit coverage for equivalent live/stored completion timestamp formatting.
- Existing HB source-space tests remain in the suite.
- PR CI must pass `npm test`, Electron syntax checks and `npm run build` before merge.
- Final Windows/Electron visual confirmation remains recommended.
