# Feature: Codex Claude Gateway and Monitoring Plugins

## Goal and first delivery gate

Use Daniel's Claude Max login to answer Codex queries through a local Responses gateway,
while Codex retains tool execution and approvals. Native OpenAI stays on the existing
ChatGPT/Codex subscription. No API billing fallback, public hosting, automatic provider
switching, or change to existing defaults is authorized.

Before dependent integrations, prove Claude streaming, a Codex-executed tool call,
follow-up history and return to native OpenAI in the installed desktop app. Verify
conversation-panel support before implementing full panels. If this gate fails,
stop the dependent work and retain the blocker explicitly.

## Accepted remaining scope

- `harness codex serve`: authenticated localhost service, per-thread records, tool-call
  correlation, cancellation, retries, process failure and quota exhaustion.
- Provider/model discovery; default Claude Opus 5.5 at xhigh. Expose provider status,
  model list and queued switching. Switch remains pending until idle and closed on all
  clients; cold-resume the same thread, verify applied settings, preserve prior
  configuration on failure.
- Harness plugin: explicit session-to-loop bindings, goals, pending steps, evidence,
  latest verification and stale status after edits. One rejection per failed evaluation,
  failing checks separately. New evaluation IDs/session attribution; idempotent hooks;
  historical traces keep project-only attribution.
- SessionStart restores guidance; edit hooks invalidate verification; Stop evaluates
  linked changed loops. At most two correction continuations per original turn.
  Interruptions remain interrupted; passing evaluators never replace explicit evidence.
- Claude plugin: isolated `/usage` session, five-hour/weekly/model windows and resets,
  observation timestamp, unknown for missing/stale values, cache 60 seconds and refresh
  no more frequently than five minutes while visible. No quota-measuring model prompts.
- Both conversation panels and an observed-session dashboard. Git-backed manual plugin
  marketplace, dependency checks, hook trust instructions and reversible setup.
- Red/green regressions, full repository checks, desktop Claude/OpenAI/Claude round
  trip, separate phone/voice tests, fresh inspected panel screenshots and local commit.

## Current delivery status: first gate blocked

On 2026-10-07 the computer-use tool refused access to `com.openai.codex` for safety
reasons. No desktop provider round trip or panel installation can be verified in this
session. This is a tool access blocker, not proof that Codex lacks these capabilities.
No workaround to that UI restriction is used. Native desktop defaults remain unchanged.
Dependent plugins, quota collector, marketplace and provider-switch service remain
unimplemented. Their acceptance checks and the feature loop stay pending.

## Experimental gateway slice

`harness codex serve --token-file <owner-only-file> [--port 47831]` binds only
127.0.0.1. The token must contain at least 32 characters; browser origins are rejected.
It uses Claude Agent SDK with the existing local Claude Code executable/login, removes
API/provider environment overrides, disables built-in execution tools and registers only
Codex bridge tools. It does not extract subscription tokens.

Supported experimental transport is streamed POST `/v1/responses` with `thread-id`,
full replay history and flat function/custom tools. Incremental `previous_response_id`,
other models and unsupported tool shapes fail closed. Exact completed requests replay
within the running process; cancelled sessions require explicit recovery. Records and
replay caches are memory-only: this is not a durable session or restart-recovery service.
Each process allows at most 100 observed threads and 16 completed responses per thread.
The prototype does not register a provider/catalog or expose plugin services.

## Evidence

- Installed desktop-bundled Codex CLI: 0.160.0. Claude Code: 2.1.288, Max login.
- Subscription preflight returned `harness-gateway-preflight` with Opus 5.5/xhigh.
- Six initial regression assertions failed on generated stubs, then passed unchanged:
  authentication/origin/model checks, SSE text/function IDs, session isolation and cancel.
- Retry regression initially failed twice, then passed: byte-identical stream replay
  without another query; cancellation cannot restart ambiguous work.
- Live SDK smoke requested `read_marker`, waited for its correlated output, then streamed
  `gateway-marker-72`. The smoke host supplied that output; this does not prove desktop
  Codex execution. Generated evidence remains ignored under `.cache/codex-gateway/`.
- A separate read-only `codex exec` smoke using the desktop-bundled 0.160.0 binary
  selected the temporary gateway provider but failed before completion with
  `Claude query failed; no fallback was used`. This is a failed compatibility check,
  not a successful desktop integration. No provider/default configuration was persisted.
- `bun run check` passed on the final prototype: formatting, type checks, lint, unit
  and CLI E2E suites, build, packed-package test and both Harness audits. Existing
  skipped tests remain skipped; no live desktop, phone or voice verification is implied.
- Current prototype server is on 127.0.0.1:47832. The earlier smoke listener on 47831
  was left running according to the project server-preservation rule. Both use the
  ignored owner-only token file; neither is registered in desktop provider settings.
- Desktop round trip, panel screenshots, phone reconnection and voice: blocked/not tested.

## Resume condition

Resume the first desktop delivery gate in an environment with authorized Codex UI access.
Do not build dependent panels or market this prototype as installed-client compatible
until that gate passes. No production or package publication is part of this delivery.
