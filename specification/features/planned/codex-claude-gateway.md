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
full replay history and flat or namespaced function/custom tools. Incremental `previous_response_id`,
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

## Local desktop trial setup (2026-10-07 follow-up)

The user authorized pushing main and installing a local trial. The original prototype
was pushed as c4e9deb. The rejected namespace shape is now repaired, with three
red/green assertions for flattening, namespace correlation and fail-closed hosted tools.

Installed in the user-level Codex configuration:

- Provider `harness-claude`, gateway `http://127.0.0.1:47836/v1`.
- Command-backed local gateway authentication reads the existing ignored owner-only
  token file. No subscription token is extracted or placed in TOML.
- Opt-in CLI profile `~/.codex/harness-claude.config.toml`: Opus 5.5/xhigh, explicit
  disabled OpenAI-hosted web search, and a private local catalog. The catalog advertises
  text only, a conservative 32K local context limit and structured Responses tools.
  Responses Lite is explicitly disabled because the gateway does not support that wire
  format. CLI profile selection does not activate a desktop profile.
- Native OpenAI remains the default, as explicitly confirmed by the user. Claude is an
  opt-in per-conversation choice. Existing loaded conversations stay on their current
  provider. A private pre-install configuration backup is retained under
  `~/.codex/harness-gateway/`.

Verification: desktop-bundled Codex 0.160.0 performed a real read-only `cat marker.txt`
through a Claude-requested bridged tool and returned an unpredictable marker matching
the file. The same saved CLI thread resumed through Claude, native OpenAI, then Claude;
all three retained that marker and reported the expected provider. An earlier catalog
misconfiguration returned fabricated tool-like text; it was rejected as evidence and
fixed before this proof. `bun run check` passed after the namespace repair.

The desktop UI gate remains pending: official gateway setup requires an app restart
after configuration changes, and this session cannot operate the desktop UI. No app
restart or live-thread provider switch was forced. Dependent plugins, paired-phone
reconnection and voice verification remain deferred. Trial setup is reversible by
removing the added provider/profile/catalog and restoring only any trial default keys
from the private backup; preserve unrelated later configuration edits.

## Confirmed selector behavior

The user confirmed keeping OpenAI as the default and choosing providers with a small
selector. The planned conversation panel offers OpenAI and Claude, shows the active
provider separately from a pending selection, and preserves the same thread/history.
Selecting a provider queues a request; it applies only after the thread is idle and
closed on all connected clients, then the resulting provider/model is verified.
Failed application retains the previous configuration. Selecting Claude must never
change the global default or route native OpenAI through the gateway.

This selector is not implemented or installed. The first desktop delivery gate and
installed-client panel-support check still precede its implementation. CLI round-trip
proof does not satisfy those desktop checks.
