# Environment and deployment controls

Commit, Branch and workbench/project selectors start closed behind labelled icon buttons. Existing selectors retain their keyboard, navigation and read-only behavior. Escape closes the dialog and restores focus. Dev, stage, preprod and prod remain directly selectable.

The selected environment is an authoring target, independent of the branch/commit being inspected. Display the environment's last verified deployment, its commit and deployment time separately from the selected commit's Git commit time and branch tip commit time. Missing timestamps say Unknown or Never deployed; a branch tip date is not a deployment date.

An environment-scoped Change validates and commits its source, then deploys the same commit through configured dev, stage and preprod targets up to the requested environment. Requests from prod stop at preprod and say that Deploy is required for production. Unscoped requests and projects with no configured deployment target retain local-only behavior, explicitly labelled in the toolbar. Agents never receive deployment credentials or permission to deploy.

Deploy opens one production promotion modal, independent of the selected browsing revision or environment. Opening reads a short-lived, single-use plan without deploying. Show the verified preprod and current production commit IDs and their Git ancestry distance, with one Promote to production button. A missing production receipt is an initial deployment with the preprod history count; identical or divergent history blocks promotion. Show live check, build, upload and health progress, and terminal success or failure.

Production always deploys the exact verified preprod source in an isolated detached worktree, preserving the user's checkout and uncommitted changes. Require unchanged project, deployment configuration, preprod and production receipts, verified preprod configuration, commit ancestry, check/build and deployment health. Invalidate stale plans. Chat may reach preprod but never production. No source branch is pushed or environment branch merged by the adapter.

Start with Cloudflare Workers and Pages. Detect Wrangler JSON, JSONC and TOML and named Worker environments. Explicit harness.deploy.json mappings resolve aliases and Pages branches, project account and credential variable names. Never infer a safe environment from a branch name alone. Pages confirms the live production branch before upload. Ambiguous, unconfigured, unauthenticated and failed targets remain blocked. Store deployment receipts in the Git common directory, outside tracked source, only after deployment identity and health verification. No live project is deployed as part of implementation testing.

## Packaged dependency verification

Source and Vite tests did not expose the JSONC package's UMD-relative requires in the Electron bundle. The existing config boundary tests now build and execute their Node artifact during the normal unit suite. New Electron main/preload dependencies must pass that checkpoint under the local AGENTS.md rule. The guard failed for the UMD entry, passed for ESM, rejected restoring UMD, and passed after restoring the repair. The built native app then passed its unchanged flow.
