---
status: planned
---

# Tracker planning stages

Tracker item `y3y8892zc6` · Harness CLI, Mac and iPhone

| Stage          | CLI value | Artifacts to prepare                                                                                    |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| Idea           | `idea`    | A one-paragraph idea.                                                                                   |
| Detailed idea  | `detail`  | A detailed description and designs for at least two main pages when the work has that many.             |
| Full design    | `design`  | Designs for every page, with descriptions of empty, loading, error, filled and other applicable states. |
| Implementation | `build`   | Build, PR and verification links or notes.                                                              |

## Item and commands

Every item starts at Idea, including items created by older clients. Stage is independent of Tracker status. An explicit promotion advances only to the next stage. Retrying the current stage succeeds without a write. Skips and demotions return a conflict. The operation records the Tracker actor and server time. Users review the stage's artifact checklist before promoting, since Tracker cannot verify the completeness of an external design.

- `tracker stage ID idea|detail|design|build` promotes. `--by` follows the existing Tracker actor convention.
- `tracker artifact ID STAGE FILE` saves the stage's artifact document from a JSON file. The document accepts `summary`, `pages` (named pages with optional `states` descriptions and labeled `links`), and top-level `links`. Links use public HTTPS URLs with no credentials. Set a link's `kind` to `image` when it points to a design image. Save a replacement document as designs change. A file containing JSON `null` clears the artifact.
- `tracker list --stage STAGE` combines stage with existing filters and applies them before the limit. List, show, and digest show the stage in text and JSON. Show includes artifacts and promotion receipts in JSON.
- The local API exposes the same behavior through `POST /items/ID/stage`, `POST /items/ID/artifact` and `GET /items?stage=STAGE`. Generic item update cannot bypass promotion.

## Storage and sync

Use the existing journal and schema replay. Each promotion target and each stage artifact has its own projected field so delayed writes and concurrent updates to different stages cannot lower the stage or remove another stage's artifacts. Repeated concurrent promotion to the same target resolves through Tracker's journal clock. Older peers retain the operation for replay after upgrade. Planning records stay within the existing phone replica's bounded pages and item visibility rules.

## Mac and iPhone

Keep the existing Tracker item list and detail. Add the stage label to row metadata and show the current stage, each stage's saved artifacts, and the actor and time of promotions in the detail. Use the existing muted status treatment for empty artifacts. Labeled design links open in the system browser when selected. Use a descriptive label for image links. The phone replica retains the section alongside existing offline item data. The CLI is the promotion and editing surface.

## Acceptance

Exercise the CLI against an isolated node, including legacy rows, all promotions, retry, invalid jumps, artifact validation, filters, digest and actor/time. Verify journal replay and a phone replica snapshot or delta with stage data, then open the shared item view in Mac and phone contexts with populated and empty artifacts. Qualify the merged revision before releasing to the two Macs. Production requires Daniel's approval.
