# Feature: Image Threads

## Overview

Provide a native Electron Harness workspace matching the approved navy/gold image concepts. Users select a local repository, browse its five entity categories, review committed image versions or headless behavior notes, and send scoped Plan or Change requests from the entity conversation.

The renderer uses the typed preload bridge. It has no filesystem, process, credential or arbitrary IPC access. A normal browser displays a read-only project gate.

## Acceptance Criteria

- Native Open Project selects only the chosen Git repository; cancellation preserves the existing view.
- Pages, Components, Functions, Configs and Services remain reachable on desktop and mobile. No global App/Plan toggle is introduced.
- Catalog search, changed-only filtering, sort, thumbnails and title/goal draft creation use the selected snapshot.
- Implemented page cards open through a compact icon link with an accessible label and hover tooltip. Planned design review actions keep their labels.
- Branch and full-commit paths retain encoded branch and entity identities. Branch selection displays the actual tip. Other branches and explicit commit views remain read-only in both UI and native bridge.
- Entity views expose Design, Contract, Relationships and entity-specific History. Details → Source is the only source-disclosure path.
- Designs show actual committed versions and available viewport/state choices. Missing images are not replaced by newer artifacts. Headless designs show their recorded notes.
- Pointer rectangles and keyboard region controls use normalized coordinates. Whole-image comments and numbered pins bind to the exact image/version.
- Plan/Change, CLI provider, discovered model and effort controls remain inside the composer. Unavailable providers are disabled with a reason.
- An initial Plan request can create a thread with no image. Change requires a current exact approval; headless approval binds behavior notes and contract without a fabricated image.
- Approval alone never runs code. Agent success and approval never imply runtime verification.
- Public run messages, status, cancellation and failures are shown faithfully. Successful artifact commits refresh the selected entity.
- Agent instructions require behavior notes of at most 30 words and 200 characters, and each simplification/performance attempt of at most 15 words and 140 characters.
- Verification uses an accessible binary icon with a reason; the Plan badge is independent. Size/performance availability reflects the supplied evidence.
- Native renderer isolation, constrained project IPC, blocked remote navigation and denied child windows are verified against a test-owned Electron process.
- Visual acceptance uses fresh, decoded-image/font-ready screenshots, kept outside Git.

## Verification Evidence

The desktop implementation has the following focused coverage:

- `tests/e2e/ui-workspace.spec.ts`: read-only browser gate; designless Plan; canonical branch/commit routes and actual href encoding; provider and Change gates; catalog search/filter and draft submission.
- `tests/e2e/ui-designs.spec.ts`: image pins; pointer and keyboard regions; exact approval followed by explicit Change; public stream/cancel; Details → Source; responsive drawer; notes-only designs.
- `test/stores/workspace.test.ts`: no-bridge behavior and historical branch/full-SHA/tip identity.
- `tests/e2e/native-desktop.spec.ts`: real native chooser flow, disposable Git/LFS commits, public planning API PNGs, native image byte reads, UI approval persisted to Git, historical UI/IPC denial, sandbox/context isolation and blocked navigation/popups.

The focused renderer suites passed six browser tests and two store tests. The native suite passed independently using built Electron bundles; its final scoped run completed in 10.3 seconds. These results cover fixtures and native integration, not a newly executed real coding/image-generation request. The primary implementation task owns actual CLI smoke evidence and final package-wide checks.

The original placeholder route was replayed to prove the project-gate regression fails before the renderer is restored. See [loop evidence](../../../../../specification/loops/harness-image-threads/desktop-ui-native-evidence.md) for commands and evidence locations.

## Future Enhancements

The separate core task owns verification-index and runtime-screenshot integration. Consume its published entity/revision evidence without treating design approvals or CLI completion as test passes. Whole-project release readiness remains gated by package-wide checks and the primary task's runtime integration verification.
