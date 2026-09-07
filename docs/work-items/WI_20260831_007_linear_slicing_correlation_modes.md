# WI 20260831 007 — Linear slicing and correlation modes

## Goal
Make higher-dimensional uniform Linear sweeps directly inspectable in Results without collapsing dimensions, and make the correlation matrix compact by default while retaining optional access to all stored scalar metrics.

## Requested behavior
- In `Linear > Landscape`, when more than two parameters vary, allow the user to choose any two as X/Y and explicitly fix every remaining varying parameter to one of its stored values.
- Build the landscape only from rows matching those fixed values exactly; do not average or interpolate over hidden dimensions.
- Keep Point data immediately below the Landscape and ensure the selected point belongs to the active slice.
- In `Linear > Correlation`, default to `Additional columns: None`, showing varying parameters only.
- Provide `Additional columns: Metrics` to add all stored scalar metrics to the Pearson matrix.

## Scientific constraints
- Slicing is a selection operation over the persisted uniform dataset, not a new numerical calculation.
- No optimizer samples may enter the Linear landscape or correlation calculation.
- Pearson correlation remains descriptive and must not be presented as causal parameter importance.
- No `.jco` schema, simulation engine, optimizer mathematics or stored values are changed.

## Validation
- Unit tests for exact fixed-coordinate slicing and correlation dimension selection.
- TypeScript/GUI build validation.
- Runtime check with a Linear sweep containing at least three varying parameters.
- Verify Point data follows the visible slice after changing a fixed value.
- Verify `None` shows parameters only and `Metrics` adds every scalar metric column.
