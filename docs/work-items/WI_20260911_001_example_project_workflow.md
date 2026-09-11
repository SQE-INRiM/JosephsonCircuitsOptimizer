# WI_20260911_001 — Example project workflow and background circuit preview

## Classification
T2 — user-visible GUI behavior and desktop-bridge/project-lifecycle change. The change does not modify the `.jco` schema, simulation mathematics, metric semantics, units, or JCO numerical outputs.

## Goal
Make first launch and bundled examples easier to understand and use, while allowing circuit-preview generation to continue without blocking unrelated Setup work.

## Project lifecycle contract
- Desktop startup creates a real unsaved `New project` session from the default template.
- The startup UI points users to bundled examples instead of presenting a device-specific placeholder as if it were the active project.
- Valid `.jco` files placed in `gui/runtime/examples/` are discovered dynamically from their manifests; no source-code registry is required.
- Opening a bundled example creates an editable temporary session and never overwrites the repository-shipped example.
- Bundled examples may run directly in that temporary session.
- Ordinary unsaved new/imported projects still require `Save As` before a scientific run so user-created output has an explicit durable project destination.
- Saving an example uses the existing `Save As` flow when the user wants a persistent copy.

## Circuit preview contract
- Existing ADR 007 remains authoritative: preview execution is explicit and resolves topology through JCO rather than source parsing.
- Preview generation may remain active while the user navigates to Device parameters, Sources, Computation, or Metrics.
- The preview result corresponds to the circuit/parameter snapshot used when generation started.
- If relevant circuit code or preview parameters change while generation is in flight, the returned preview must be shown as stale rather than represented as current.
- A second preview must not be started accidentally while the first generation is still active.
- Long-running preview work must not block ordinary renderer interaction.

## Acceptance criteria
- Fresh desktop launch shows `New project`, not the Carthago project name.
- Startup guidance tells the user that bundled examples are available.
- Adding another valid `.jco` file to `gui/runtime/examples/` makes it appear in the examples menu without a code change.
- A bundled example can start a run without first saving a copy.
- A normal unsaved New project still receives the durable-project / Save As protection when a run is requested.
- Example execution does not overwrite the bundled source `.jco`.
- Circuit Preview warns that complex circuits may take time.
- While preview generation is active, the user can continue configuring other Setup sections.
- Returning to Circuit during an active generation still shows the generation state.
- Changing a preview-relevant parameter while generation is active causes the completed preview to be marked stale.
- Opening a project or example alone still does not execute user Julia; Generate/Refresh remains explicit.

## Validation
Targeted automated:
- `npm test`
- `npm run build`
- node tests covering durable-project behavior, including the bundled-example exception

Manual desktop:
- fresh startup / New project message
- dynamic examples menu
- direct run from a bundled example
- Save As protection for a normal new project
- background preview across Setup navigation
- stale preview after an in-flight parameter change

## Non-goals
- Changing `.jco` format or compatibility.
- Persisting preview images.
- Running arbitrary unsaved user projects without Save As.
- Changing JCO simulation or optimization behavior.
