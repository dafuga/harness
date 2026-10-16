# Feature: Project Collaboration

## Overview

The Harness workspace works across several projects. The project name at the top left is a switcher of the local projects Electron remembers and the shared projects a person may read. Every view has a link that names its project, branch and, when pinned, full commit. People leave human comments on entities and image regions; a comment is never an agent request.

The same components and store render the hosted app through its browser bridge. What a context can do comes from the capabilities its bridge reports, never from the page guessing.

## Acceptance Criteria

- Links are `/projects/{projectId}/harness/branch/{encodedBranch}/{category}/{entityId?}/{history|details?}`, and the same with `/commit/{fullSha}` after the branch. A branch name keeps its slashes encoded.
- A bridge that reports no project identity keeps the legacy `/harness/...` links, and every legacy link still opens.
- No component cuts a fixed prefix off a path to build a link; one link component resolves all workspace links.
- The switcher lists local and shared projects. Add local project appears only where the bridge can choose a folder. Switching keeps the category, drops the entity, branch and commit of the previous project, and shows the new project at its own tip.
- A late answer for a previous project is discarded: no entity, thread, message or image of it is rendered after a switch, and every request after a switch names the new project.
- The branch picker shows the actual tip. A pinned or historical commit is stated as such and offers Go to tip.
- The composer starts in Comment wherever comments are available. Plan and Change, the provider, the model and the effort appear only where the capabilities allow agents, at a writable branch tip.
- Sending a comment calls the comment operation and never starts a run. Comments are allowed on historical commits.
- A comment the bridge reports as pending is shown as pending on this device with the bridge's reason, and is never described as saved or shared. A shared comment shows the collaboration commit that acknowledged it.
- Pending comments are read from the bridge on every load, so they survive a restart and a cleared cache.
- A bridge without the optional project operations still works: capabilities fall back to what its required operations prove.
- Selecting an image region opens the thread of that exact image with its earlier threads. Where agents are allowed the existing Plan and Change workflow is unchanged.
- Components, functions, services and configs lead with contract and size and performance, with History beside them. Source files appear only under Details, then Source.
- A branch view shows one current image. A commit view shows before and after only when the viewed commit introduced a version and an earlier image of the same viewport and state exists.
- Verification is an icon with its reason as a tooltip, without a text label.
- Where the bridge can connect this device to shared projects, a control shows the pending code and the validated approval address, asks for the status no sooner than the server's interval, and takes no address. It shows no secret, nonce or verifier.
- An offline cache event of the shown project makes it read-only before cached content is shown, and a snapshot that is a cached copy allows nothing. The view names the cached copy and its time and does not claim that membership was checked.
- A denied cache event clears the shown shared project, also when a nested source or image read caused it, and a read under way is never published. A local project stays. A later fresh event revives nothing.
- History offers further pages only when coverage is incomplete and names a next page, asks for the shown project, branch and commit, and lists an event once. An entity without coverage has its whole history.
- A message that carries an author name is labelled with it, never as You.

## Verification Evidence

- `test/utils/workspace-route.test.ts`: project and legacy paths, encoded branches, full commits, sections, refused input.
- `test/stores/workspace-projects.test.ts` and `test/utils/load-workspace.test.ts`: project selection before reads, retained category, discarded late answers, refused foreign answers, capability fallback.
- `test/stores/thread-comments.test.ts`: one comment call and never a run, pending against shared, repeated request id, refused foreign answers, drafts read from the bridge.
- `test/utils/comment-entries.test.ts`, `thread-anchor.test.ts`, `compose-modes.test.ts`, `project-capabilities.test.ts`, `project-list.test.ts`, `image-url.test.ts`, `time-label.test.ts`, `test/stores/thread-run.test.ts`: the helpers behind them.
- `tests/e2e/ui-projects.spec.ts`: switcher, project links, isolation after a switch and between equal entity ids, a late answer, a deep link with Go to tip.
- `tests/e2e/ui-comments.spec.ts`: Comment by default, a comment never starting a run, pending text after a reload with cleared page storage, a shared acknowledgement, historical comments, the image thread at a writable tip.
- `tests/e2e/ui-workspace.spec.ts`, `tests/e2e/ui-designs.spec.ts` and `tests/e2e/native-desktop.spec.ts` are unchanged and prove the legacy bridge and the real Electron bridge.

- `test/utils/cache-status.test.ts`, `test/stores/hosted-connection.test.ts`, `test/utils/hosted-address.test.ts`, `test/utils/history-pages.test.ts`, `test/utils/open-project.test.ts`: offline and denied events on the real store, a read under way that is never published, polling at the server's interval, refused addresses, paged history.
- `tests/e2e/ui-hosted.spec.ts`: the pending code and address without an address field, an offline event, a refused source read that clears the whole view, paged history and named authors.

The browser bridge of these tests is a fixture inside the test. The native connection was not exercised against a real hub: the Electron run of this worktree has no hub origin and shows the control as not set up. `test/utils/prior-image.test.ts` proves when a commit view compares before and after; its rendering was inspected in a scratch capture and is not held by a committed browser test.

## Future Enhancements

- Remote shared projects inside Electron once the main process holds a verified session.
- Publishing a pending comment from the outbox when its project becomes shared.
