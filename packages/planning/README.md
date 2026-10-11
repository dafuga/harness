# Git-backed planning

`createPlanning(repositoryRoot)` returns the typed `PlanningApi`. It uses Node APIs and Git plumbing; no Bun runtime API is used by the library. The package exports all public DTOs and an optional `handlePlanningRequest(api, request)` error-envelope adapter.

The repository needs an existing commit and configured Git author identity. PNG designs require Git LFS installed and its clean/process filters configured for the repository. Run `git lfs install --local` when preparing a repository; the library never changes global Git configuration or fetches missing LFS objects.

Writes target the current checked-out branch. Immutable design versions, approval records and thread headers retain their creation commits; message logs are append-only hash chains. Historical reads resolve only their requested commit and exact LFS object hash. Missing LFS content is shown as `content: 'missing'`; image reads and approval refuse unavailable content.

Pass `CreatePlanInput.unitId` to plan an existing canonical entity; its committed manifest must attest the exact identity and category. The requested category/slug determines its planning folder. Omit `unitId` for a new `<category>.<slug>` draft.

Plans live separately from canonical `specification/units` manifests. Creating or approving a plan never registers active code or claims runtime verification. Headless versions support notes without fabricated screenshots. Entity discussion threads may have a null anchor; image annotations bind a precise version, hash, viewed revision and normalized rectangle.

Commits use an isolated tree index and retain unrelated staged and unstaged changes. A repository operation lock serializes library writers; a Git index lock protects publication. Dirty or ignored artifact collisions, unsafe paths, tampered history and competing ref updates are refused. Stale lock directories left by a terminated process require operator inspection and removal; the library never guesses whether another process is alive.

Run `HARNESS_CLI_PATH=../../src/index.ts bun run check` from this package. Integration tests create disposable repositories, configure local identity/LFS there, and remove them afterwards. They do not mutate the developer's project data.
