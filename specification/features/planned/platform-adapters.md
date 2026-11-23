---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Platform adapters

A Harness agent can send a message to an approved external channel and reply in a
thread. The first platform is Slack. The runtime routes allowed inbound events to
the bound agent and keeps Slack credentials inside a trusted host process.

## Runtime placement

Harness Desktop on the user's computer is the default host, alongside the Harbor
node. The same host interface can run inside the optional Harbor confidential VM
(`5e504s`). An operator selects one active host per installation. The selected
host owns the adapter, channel policy, Vault access, connection and audit sink.
Its local agent invocation layer exposes the messaging capability to the agent.
The Harbor chain and consensus node carry no Slack traffic or credentials.

The cloud host needs its own approved Vault grants, outbound HTTPS/WSS access and a
durable audit sink before activation. Host migration stops the old subscriber
before starting the new one. Cloud deployment and a Desktop settings UI have
separate acceptance.

## Adapter contract

- The registry resolves an explicit adapter key and installation binding. Unknown
  or duplicate keys fail closed. A binding associates one platform workspace,
  bot identity, channels and runtime owner. Channel authorization is checked by
  the host on send and receive.
- `identity()` exposes provider-assigned workspace and bot IDs. Verify them
  against the binding at startup and before relying on a newly acquired token.
- `send(message)` takes a channel ID and plain fallback text, plus optional
  rendering data and a parent message ID. Return the provider channel/message
  receipt. Reply uses the same operation with the inbound parent or message ID.
- `subscribe(handler, signal)` delivers normalized event ID, channel, sender,
  text, message and thread references. Treat inbound content as untrusted. Filter
  non-human/system events, self messages and out-of-policy traffic. The caller
  accepts or durably queues events before resolving the handler. The owning host
  deduplicates accepted event IDs and acknowledges retransmissions.
- Audit attempts, accepted inbound events, retries and final outcomes. Retain
  metadata needed for reconciliation, such as workspace, bot, channel, request
  or event ID, provider receipt and reason code. Keep bodies, credential values,
  authorization headers, and transient connection URLs out of audit and errors.
  Fail closed if the attempt cannot be recorded. If delivery succeeded and its
  outcome could not be recorded, surface the receipt where available.
- Expose bounded retry/backoff. Retry sends rejected with a provider rate-limit
  response. Surface transport/5xx delivery as unknown so callers can reconcile
  without silently sending a duplicate.

## Slack installation and operation

Use a dedicated Slack app per workspace. Install by OAuth or from an app
manifest, subject to workspace app policy. Invite the bot to every approved
channel and record channel IDs. Request `chat:write` to post, `channels:read`
or `groups:read` for public or private channel discovery when required,
`channels:history` or `groups:history` for subscribed public/private channel
message events, and `app_mentions:read` for `app_mention`. Request only the
event and channel scopes the installation needs. Slack calls posts through
`chat.postMessage`. Use Block Kit with readable fallback text and `thread_ts`
for replies. Verify the connected bot and workspace with `auth.test`.

Receive Events API traffic using Socket Mode. A separate app-level credential
with `connections:write` opens an outbound WebSocket using
`apps.connections.open`. Desktop works behind NAT without a public callback.
Acknowledge the Socket Mode envelope by ID, deduplicate by Events API event ID,
and reconnect on disconnect or planned refresh with capped backoff. Budget
roughly one post per second per channel and honor `Retry-After` for Slack's
workspace/method rate limits.

The Credential Vault (Tracker `jw0799`) owns the Slack bot credential (`xoxb`)
and Socket Mode app credential (`xapp`). Scope credentials by project,
environment, workspace, app, approved actions and host. The host integrates via
an approved Vault capability that gives the trusted transport access only for
the bound operation. Agents and run transcripts see identity, content allowed by
policy, and receipts, never credential material or raw provider failures.
Rotation, reinstall and approval use Vault's private handoff.

- [Slack Web API rate limits](https://docs.slack.dev/apis/web-api/rate-limits/)
- [Posting messages and threads](https://docs.slack.dev/reference/methods/chat.postMessage/)
- [Socket Mode and acknowledgments](https://docs.slack.dev/apis/events-api/using-socket-mode/)

## Acceptance criteria

- An authorized host can register the Slack adapter, verify installation
  identity, send a channel message and post a threaded reply. Unknown bindings,
  channels and cross-workspace events are rejected or ignored as applicable.
- Mocked Slack tests cover payloads, threading, rate limits, unknown delivery,
  audit metadata, event filtering, duplicates, acknowledgments and reconnect.
- A one-time message labeled Harness Slack adapter test reaches a coordinated
  BuildFlexity `#alerts` or approved test channel through the installed
  Harness app. Record the channel/message receipt without credential material.
- Coordinate the test destination with Tracker `h164w0` and credential
  provisioning with `jw0799`. Keep the live check pending until the scoped
  installation and private Vault handoff are available.
