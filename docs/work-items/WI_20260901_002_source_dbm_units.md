# WI_20260901_002 — Source amplitudes in A or dBm

## Goal
Allow GUI source amplitudes to be entered in Ampere or dBm without changing the canonical JCO/Julia source-current input contract.

## Classification
T3 — scientific unit/drive-interface change.

## Scientific convention
Use the existing JCO-side convention supplied by the maintainer:

- `P = 2 * |Ip|^2 * Z0`
- `P_dBm = 10 log10(P / 1 mW)`
- `Ip = sqrt((1 mW * 10^(P_dBm/10)) / (2 Z0))`

Default `Z0 = 50 Ω`, editable per source.

## Acceptance criteria
- Linear and nonlinear amplitudes can independently use A or dBm.
- JCO `drive_physical_quantities.json` remains canonical in A.
- Fixed, List and Range modes are supported.
- A range defined in dBm is generated in dBm first and each point is individually converted to A; it must not be represented as a uniform-A range after conversion.
- `-Inf dBm` represents an off-state (`0 A`).
- Unit/display choices survive `.jco` save/open without adding GUI-only keys to the JCO drive dictionary.
- Existing projects without GUI unit metadata load as Ampere with `Z0 = 50 Ω`.
- Conversion utilities have automated tests and desktop serialization receives local validation before merge.
