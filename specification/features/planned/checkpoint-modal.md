# Checkpoint modal

Make the game editor map the main authoring surface. Adding or clicking a checkpoint opens a focused modal. Describe the desired checkpoint, generate a candidate image, request changes, then explicitly use the chosen image. Keep detailed executable rules and scene settings behind progressive disclosure.

Preserve saved-project ownership, optimistic revisions, read-only history, unsaved edit protection, graph connections and runtime progress. Reuse the shared Modal and existing project-owned image provider boundary. A candidate image must not replace the accepted reference until confirmed. Ignore late responses after closing or switching checkpoints. Keep entered guidance when generation fails and expose retry. No provider call occurs on opening the modal.

The existing game-authoring browser scenario previously proved inline field edits only. Extend it with a deterministic saved-project image boundary to prove modal creation, prompt generation, revision requests, explicit approval, graph persistence and reload. Retain existing mechanics, history, invalid graph, runtime and dirty-field assertions while adapting their navigation to the modal.

Verification: unchanged focused red/green browser scenario, desktop unit/type/lint/build/audit checks, relevant shared-import checks, desktop/tablet/mobile screenshot inspection and manual browser exercise. Root CLI suite remains deferred at Daniel's request. Paid-provider verification depends on a configured project-owned credential and must not be represented by fixture evidence.
