# Environment and deployment controls

Commit, Branch and workbench/project selectors start closed behind labelled icon buttons. Existing selectors retain their keyboard, navigation and read-only behavior. Escape closes the dialog and restores focus. Dev, stage, preprod and prod remain directly selectable.

The selected environment is an authoring target, independent of the branch/commit being inspected. Display the environment's last verified deployment, its commit and deployment time separately from the selected commit's Git commit time and branch tip commit time. Missing timestamps say Unknown or Never deployed; a branch tip date is not a deployment date.

An environment-scoped Change validates and commits its source, then deploys the same commit through configured dev, stage and preprod targets up to the requested environment. Requests from prod stop at preprod and say that Deploy is required for production. Unscoped requests and projects with no configured deployment target retain local-only behavior, explicitly labelled in the toolbar. Agents never receive deployment credentials or permission to deploy.

Deploy opens one production promotion modal, independent of the selected browsing revision or environment. Opening reads a short-lived, single-use plan without deploying. Show the verified preprod and current production commit IDs and their Git ancestry distance, with one Promote to production button. A missing production receipt is an initial deployment with the preprod history count; identical or divergent history blocks promotion. Show live check, build, upload and health progress, and terminal success or failure.

Production always deploys the exact verified preprod source in an isolated detached worktree, preserving the user's checkout and uncommitted changes. At confirmation require unchanged project, deployment configuration, preprod and production receipts, verified preprod configuration and commit ancestry. During execution require the captured source, unchanged configuration and destination receipt, check/build and deployment health. Invalidate stale plans. Chat may reach preprod but never production. No source branch is pushed or environment branch merged by the adapter.

Start with Cloudflare Workers and Pages. Detect Wrangler JSON, JSONC and TOML and named Worker environments. Explicit harness.deploy.json mappings resolve aliases and Pages branches, project account and credential variable names. Never infer a safe environment from a branch name alone. Pages confirms the live production branch before upload. Ambiguous, unconfigured, unauthenticated and failed targets remain blocked. Store deployment receipts in the Git common directory, outside tracked source, only after deployment identity and health verification. No live project is deployed as part of implementation testing.

## Packaged dependency verification

Source and Vite tests did not expose the JSONC package's UMD-relative requires in the Electron bundle. The existing config boundary tests now build and execute their Node artifact during the normal unit suite. New Electron main/preload dependencies must pass that checkpoint under the local AGENTS.md rule. The guard failed for the UMD entry, passed for ESM, rejected restoring UMD, and passed after restoring the repair. The built native app then passed its unchanged flow.

## Concurrent deployment activity

A labelled deployment activity light remains in the app's top-right corner. It indicates active work without relying only on colour, opens active and recent deployments labelled by destination (dev, stage, preprod, prod), and opens each deployment's current step, source commit, timestamps, errors and receipt. The production promotion modal and activity details use the same progress/detail components. Reduced-motion preferences disable pulsing.

The host keeps one activity registry across desktop windows and projects. Short start requests return a job immediately; jobs survive changing the selected project or closing their originating window. The local-only activity API exposes no repository paths, commands or credentials. Remote devices and hosted read-only views cannot access it.

Every environment builds its captured immutable commit in its own temporary checkout. Different destination targets may run concurrently; uploads to the same target are queued. A verified chat change queues dev through its selected cap (at most preprod), then releases the agent run; it never reports queued deployments as already deployed. Each queued higher job requires its own lower job's successful receipt. Failure stops dependent jobs while independent work continues. Production still requires its explicit, reviewed promotion action.

Validate configuration, source and predecessor receipts when admitting work. After admission, later source commits and newer lower-environment receipts may advance while the captured deployment finishes. Configuration changes, modified build source, destination receipt drift, backwards promotion and failed health checks block publication of a verified receipt. Receipt writes merge atomically so concurrent environments cannot erase one another. Keep bounded recent history without dropping active jobs. Browser polling retains last-known work on read failures and resumes after navigation.

Deployment rows and shared details show a source → destination route, alongside the destination deployment label. Capture the actual configured predecessor at admission, including skipped environments; the first environment shows its source Git branch. Routes stay fixed while later commits or lower-environment receipts advance. Announce the route as from source to destination for assistive technology.

## Deployment presentation

Use one visual language for promotion, activity rows, directional routes and deployment progress. Give source and destination, current commit identities and status distinct, readable hierarchy. Production keeps exactly one promotion button and complete readable commit IDs; activity details reuse progress for queued, running, failed and verified outcomes. Preserve keyboard focus, reduced motion, timestamps and viewport fit at 390px. Visual polish changes no deployment admission, adapter or production authorization behavior.

## Main integration and toolbar order

The environment selector precedes the branch, commit and deployment icons in the top-right toolbar. Keyboard order follows the visual order. General project chat, like entity chat, carries the selected available environment for Change only. Both run paths validate deployment configuration before admitting a scoped change and reuse the verified promotion chain, capped at preprod. Production remains a single explicit promotion from preprod through Deploy.

Integration verification preserves current main behavior: Helpers and Models are catalog categories; general chat permits explicit Change at a writable tip and stays available read-only in history. Search opens a modal from its icon. Tests exercise collapsed revision icons, modal search bounds and protected read-only chat rather than expecting the older always-visible fields.

## Compact mobile workspace and dialogs

At 320px and 390px the persistent standalone mobile header stays at or below 184px, leaving room for project content. Keep the environment directly selectable to the left of revision and deployment controls; workbench, branch, commit, search and deployment activity remain accessible. The selected context and its timestamp stay on one line; an environment summary reads Updated at followed by its deployment date and time. All category links and their text labels must remain fully visible inside the navigation and viewport, including after the last category is selected. Use compact wrapping rather than an invisible horizontal scroller. Responsive acceptance checks measure each label and control, as well as the container and document bounds.

Promotion, concurrent activity and shared deployment details remain within the viewport with at least 8px clearance, including 320×480 short screens. Tall content scrolls inside the dialog; the promotion action remains visible during progress and completion. Preserve complete readable commit IDs, distance, routes, status, all steps and receipts, focus restoration and one production action. Browser coverage owns both narrow-width and short-height acceptance states; width-only overflow checks are insufficient.
