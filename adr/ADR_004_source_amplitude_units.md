# ADR_004 — Source amplitude units are a GUI/domain concern

- Status: accepted
- Date: 2026-09-01
- Scope: source configuration and project serialization

## Context

JCO and JosephsonCircuits consume source current amplitudes. Users commonly specify microwave drive levels in dBm, while DC and low-power source values are naturally expressed in Ampere. Changing the engine input contract would spread unit handling into simulation code and risk mixing display units with solver units.

## Decision

The canonical simulation representation remains Ampere in `drive_physical_quantities.json`.

The GUI source model may independently mark Linear and Nonlinear amplitude values as `A` or `dBm`, with a shared per-source reference impedance `Z0` (default 50 Ω). dBm is converted to current before the workspace is handed to JCO.

The conversion convention is:

`P = 2 |Ip|^2 Z0`

and therefore

`Ip = sqrt((1e-3 * 10^(P_dBm/10)) / (2 Z0))`.

A dBm range is expanded in dBm and converted point-by-point to an explicit Ampere list. This preserves the user's requested equal-dB spacing. `-Inf dBm` maps to `0 A`.

GUI-only unit/display metadata is stored outside the JCO `user_inputs` dictionaries in `jco_gui_metadata.json`, so the generated JCO inputs remain compatible and scientifically unambiguous.

## Consequences

- Existing Ampere projects remain valid and default to A/50 Ω when no GUI metadata exists.
- Switching display units can turn a Range into a List when the transformed points are not uniformly spaced in the destination unit.
- The Julia simulator does not need dBm-specific logic.
- Parametric/function-defined amplitude units remain a separate follow-up design item.
