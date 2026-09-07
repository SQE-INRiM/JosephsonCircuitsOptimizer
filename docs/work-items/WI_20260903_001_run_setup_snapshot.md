# WI_20260903_001 — Run setup snapshot in Results

## Classification

T2 — user-visible Results/provenance feature.

## Goal

Let a user inspect the exact Setup inputs associated with each stored run, especially source configuration, without depending on the Setup currently being edited and without expanding the normal Results page.

## Existing source of truth

JCO bookkeeping already copies `user_inputs` into each run's `inputs_snapshot/`. This work reads that existing immutable snapshot; it does not change how runs are created or simulated.

## Scope

- Read `device_parameters_space.json` from the selected run snapshot.
- Read `drive_physical_quantities.json` from the selected run snapshot.
- Read `simulation_config.json` from the selected run snapshot.
- Read `optimizer_config.json` from the selected run snapshot.
- Add a compact `View run setup` control to Results.
- Open setup information in a dialog rather than occupying permanent Results-page space.
- Present one category at a time using Device parameters, Sources, Simulation, and Optimizer tabs.
- Present stored entries as variable/value rows while preserving the original stored variable names and values.

## Scientific contract

- No solver, optimizer, circuit, sweep, source-generation, or cost-function execution is changed.
- No existing run data is rewritten.
- Values shown in Results come from the selected run's snapshot, not the current editable Setup.
- Missing historical snapshot files are shown as unavailable rather than inferred.
- Presentation changes must not reinterpret or rescale stored values.

## Validation

- TypeScript/Vite build.
- Existing test suite plus focused snapshot-selection and variable/value transformation tests.
- GitHub governance/build checks.
- Before merging into the recovery baseline, rerun the known Windows baseline simulation and confirm Linear performance remains at the approximately 2-second baseline.
