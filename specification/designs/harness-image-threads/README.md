# Harness image threads: design proposal

Five final GPT Image concepts for a future Electron Harness interface. These are committed design specifications, not implemented pages or approval to build Electron. Projects, hashes, people, events and verification indicators inside the images are synthetic examples.

The normal navbar remains Pages, Components, Functions, Configs and Services. There is no global App/Plan or Explore/Plan toggle. An entity may carry a Plan badge while its design is being reviewed.

| Concept                                    | Final image                                             | Previous image                                          |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| Pages with a planning thread               | [v2](pages/catalog/designs/v002/desktop.png)            | [v1](pages/catalog/designs/v001/desktop.png)            |
| Page image annotation and history          | [v2](pages/activity/designs/v002/desktop.png)           | [v1](pages/activity/designs/v001/desktop.png)           |
| Component annotation and model selection   | [v2](components/activity-feed/designs/v002/desktop.png) | [v1](components/activity-feed/designs/v001/desktop.png) |
| Design review and approval                 | [v2](pages/design-review/designs/v002/desktop.png)      | [v1](pages/design-review/designs/v001/desktop.png)      |
| Approved design and a pending code request | [v2](pages/approved-designs/designs/v002/desktop.png)   | [v1](pages/approved-designs/designs/v001/desktop.png)   |

## Comment input

The same bordered comment input contains message text, Plan / Change, Codex CLI / Claude CLI, the selected CLI's model menu and Send. Selecting a CLI filters its model menu. The component concept shows this menu open. There are no detached provider settings.

- **Plan** asks the selected agent to revise a design using GPT Image. It produces a new committed image version and keeps the entity marked Plan.
- **Change** requests a code change through the selected local CLI and model. For an approved design, the request identifies the approved image version and hash.

The selected agent orchestrates the request; GPT Image generates the visual design. CLI/model names in these images illustrate the proposed selector, rather than asserting installed backend support. The Electron app and CLI dispatch are future work.

## Image annotations and history

Highlighting a region on an image exposes Comment and opens its thread. The anchor records entity identity, design version, image SHA-256, viewed source revision, viewport/state and a normalized rectangle. Pins remain attached to the original image when a new version is generated.

The thread shows the selected entity's previous designs, comments, decisions and commits. It can include that entity's other image threads, clearly identifying their anchors; it never substitutes another project's activity. Message records retain Plan / Change, CLI, model, timestamp and referenced image hash. Source files remain in Details → Source.

Approvals reference exact image hashes and contracts. Editing an approved design produces a new version requiring review. Design approval never implies passing runtime tests. Planned units display a cross until fresh verification covers their applicable states; only verified existing units display a check. Runtime status has an accessible tooltip.

## Repository packaging

These mockups are staged under `specification/designs/harness-image-threads/`, grouped into page/component folders with their own `designs/v001/` and `designs/v002/`. They are a specification package, not active registry entries. PNGs use this package's scoped Git LFS attributes; metadata and prompts are ordinary Git files.

[Folder structure](folder-structure.md) proposes the eventual per-unit source layout. Existing `specification/units/<id>.json` manifests remain canonical. The current generator does not yet implement these proposed folders or a planned manifest status; implementing them requires a later approved generator change.

Design images belong to normal project branches and commits. Test-owned screenshots, audio and verification manifests remain in the existing `harness-evidence` history with Git notes linking tested source revisions. A generated mockup must never be presented as test evidence.

## Delivery

All five v2 images were generated with the built-in GPT Image tool and visually inspected. [Prompts](prompts.json) retain the initial edits and final corrections. [Manifest](manifest.json) and each version's `design.json` record dimensions, byte size and content hashes. Prior v1 images are preserved without rewriting them.

No Electron app, image annotation implementation, model dispatch, planned entity registry or new runtime page has been added. The separate Opus implementation branch retains the previously approved Harness work.
