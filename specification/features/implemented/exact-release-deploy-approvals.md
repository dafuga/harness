---
status: implemented
shippedIn: null
unitIds:
  - desktop.page.development-tooling-deploy-approvals
  - desktop.component.development-tooling-deploy-approval-card
  - hub.endpoint.accounts-access-api-deploy-approvals
  - service.execution-runtimes-scripted-deploy-deploy-approval-client
owner: null
reviewedAt: null
---

# Exact-release deploy approvals

Tracker `gg97k9nqf3` extends the scripted deploy authority in `56x4kx`. Harness on Mac and Harness Studio on iPhone share one deploy review surface. Each uses its own authenticated native Hub session.

## Acceptance criteria

- A configured scripted runner waiting for a preprod or production mutation registers one short-lived request for its exact plan. The card shows the project, environment, action, target, source revision, artifact and release digests, plan and parity digests, predecessor sign-off and smoke, pending smoke contract, rollback identity and expiration.
- Allow and deny require the configured, verified Google actor in a live native Hub session. They compare the reviewed run ID and plan digest with an unexpired pending record. Both decisions are terminal. Concurrent decisions return one receipt. The app refreshes decisions online and shows the outcome returned by the authority.
- A dedicated runner grant is bound to one project and environment. The Hub atomically consumes an allow once, while the deciding session remains live. The broker must then sign the same plan and reference the decision receipt. The runner verifies the configured Daniel signature, pin, current parity, predecessor and artifact before apply. Loss of the one-time response requires a fresh attempt.
- A generic Tracker answer, non-owner or scoped session, denied or expired attempt, revocation, plan drift and replay never reach the synthetic provider. Tracker may record the verified receipt reference.
- Existing registries continue on their configured broker path. Provider activation, live key provisioning and environment deployment have separate release gates.

## Verification matrix

- Hub API lifecycle covers pending, allowed, denied, consumed and expired with the real migration and atomic database operations. It also covers invalid request shape, identity and audience, wrong scope, simultaneous requests and revoked sessions.
- Scripted deployment integration uses the reviewed fixture broker and synthetic provider. It verifies the exact-plan decision reference at the existing signed approval gate and proves application rejects unsigned, wrong-scope and reused decisions.
- The approval page and review dialog are exercised through the Electron and Capacitor renderer adapters at desktop, tablet and phone widths. Verify full digests, both decision actions, authoritative receipts, refusal after a failed refresh and no horizontal overflow.
