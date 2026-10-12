# Feature: Harness collaboration

Google users review their own projects, invite collaborators, and comment on exact committed images. Hosted comments never invoke agents. Electron supports the same projects, with local Plan/Change controls.

## Acceptance criteria

- Google tokens are cryptographically verified; challenges, sessions and native PKCE exchanges reject replay, mismatched identity and origin.
- Owners connect authorized GitHub repositories; invitations require the intended verified identity and support expiry, one-use acceptance and revocation.
- GitHub preserves project membership and concurrent, idempotent comments. Server and native caches are disposable, scoped to identity/project/revision/evidence and checked for integrity.
- Top-left switching preserves canonical project/branch/commit/category/entity paths and clears prior-project thread/image state. Private APIs, assets and exports require membership.
- Comment is the default composer mode. Hosted execution endpoints deny every request; local pending drafts remain explicit and survive cache deletion.
- Root checks and security/integration/browser tests pass. Fresh screenshots are inspected; provider configuration or locked-Mac gaps stay explicit.

## Delivery boundary

Use synthetic fixtures in this public repository. No production publication or real outbound invitations are included. Source commit, tests and evidence are recorded before handoff.
