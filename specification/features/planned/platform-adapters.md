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
for replies. Verify the connected bot and workspace with `auth.test`. A binding may
also name one direct message (`D…`), such as an owner's own digest; it is
allowlisted by id like any channel.

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

## Host integration and verification

The Harness SDK exports `SlackAdapter`, `PlatformAdapterRegistryService`,
`PlatformMessagingService` and `PlatformAuditLogRepository` from
`@dafuga01/harness`. The host registers an installation explicitly. It can
attach `platform_identity` and `platform_send_message` to an authenticated,
agent-specific MCP session. Both tools are fixed to that installation for the
life of the session. To reply, pass the event's `threadId`, or its `messageId`
when starting a thread. Keep message timestamps as strings.

```ts
import {
	PlatformAdapterRegistryService,
	PlatformAuditLogRepository,
	PlatformMessagingService,
	SlackAdapter
} from '@dafuga01/harness';

const audit = new PlatformAuditLogRepository(auditPath);
const adapter = new SlackAdapter({
	installation,
	channels: approvedChannelIds,
	receive: 'mentions',
	vault: scopedVaultAccess,
	audit: (event) => audit.append(event)
});

const registry = new PlatformAdapterRegistryService();
registry.register('slack', installation.installationId, adapter);
const messaging = new PlatformMessagingService(registry, 'slack', installation.installationId);
messaging.registerMcpTools(agentMcpServer);
await messaging.subscribe(acceptIntoAgentInbox, shutdownSignal);
```

The host supplies the installed workspace ID, Slack app ID, bot ID, bot user ID,
Harness project and environment. It also supplies the approved Vault capability,
an owner-only audit destination outside the checkout and an inbox handler.
The inbox handler should durably deduplicate the installation/event ID pair
before returning and finish within Slack’s acknowledgment window. The adapter keeps a bounded in-memory window for redeliveries
during a host run. Use a private, host-owned audit directory. A successful send
with `auditRecorded: false` still has a Slack receipt. Reconcile it before
another send. A result with status `unknown` requires checking the destination
before retrying.

### Slack app manifest

For receive mode `mentions`, start with the following manifest and add
`channels:read` or `groups:read` only if the operator needs channel discovery.
For `messages`, subscribe to `message.channels` with `channels:history`
and/or `message.groups` with `groups:history`, using the scopes for the
approved channel types. Configure the host to match the chosen subscription.
For the send-only smoke test, `chat:write`, the workspace installation and
a channel invite are sufficient.

```yaml
display_information:
  name: Harness Slack Adapter
features:
  bot_user:
    display_name: Harness Slack Adapter
oauth_config:
  scopes:
    bot:
      - chat:write
      - app_mentions:read
settings:
  event_subscriptions:
    bot_events:
      - app_mention
  socket_mode_enabled: true
```

Generate and bind the app-level `connections:write` credential through the
approved Vault path when enabling Socket Mode. Slack issues a transient WSS
address. It stays inside the transport and requires no inbound network listener.

For live acceptance, call `identity()` and verify the approved workspace and
bot. Send exactly one message with text `[TEST] Harness Slack adapter smoke test`
to the coordinated channel. Record the returned channel and message IDs and
verify the labeled message is visible. If the result is unknown, reconcile it
in Slack before considering any retry. Desktop startup, cloud activation and
the live Slack test remain pending until their host wiring and approved Vault
installation are available.

## Tracker inbox rules

Inbox rules use Tracker's designated adapter runner and its journal. The Gmail
provider checks the mailbox bound to that runner. It reads message IDs, thread
IDs, arrival times, labels and the From header. Gmail evaluates keyword phrases
using its normal search semantics. Tracker never pulls the message body,
subject, snippet or attachments into its action payload. Sender and domain
rules compare the From header. Treat that header as a routing signal rather
than proof of identity.

Add one rule per action. The selectors on a rule are alternatives. Use commas
to pass multiple values to a selector. For example:

```sh
tracker adapter add gmail --target vendor-reply --title 'Vendor reply received' \
  --thread THREAD_ID --domain vendor.example --notify TRACKER_ITEM \
  --after 2026-11-26T17:00:00Z --dry-run
```

A notification adds a note to the named item and queues a message in the Chief
of Staff channel. To create a task, replace `--notify TRACKER_ITEM` with
`--agent NAME` and optionally specify `--project` and `--owner`.
The task is created without launching by default. `--auto-launch match`
makes it eligible for the normal Tracker due scheduler. Task titles are supplied
by the rule owner. Inbox text never becomes task instructions.

A rule starts at registration unless `--after` specifies an earlier arrival
time. Preview that range before enabling the rule. Each poll rereads an overlap
to accommodate indexing delays. Tracker records a hashed message ID per rule
in the same transaction as the task or alert, so overlap and retry do not
repeat an action. Rule polling defers actions during 22:00–08:00 Lisbon time.
Use `--quiet-hours HH:MM-HH:MM` to add a quiet period in the same timezone.

On the designated reader, set `hostEffects.adapter.gmail` to the approved
`account` and the absolute path of an owner-controlled `tokenDriver`. The
executable takes no arguments and returns a short-lived Gmail read-only access
token over its private stdout pipe. The Vault owns refresh and rotation.
Harness verifies the returned account against Google's profile before reading.
The adapter registration is opt-in and needs a separately qualified binding and
release. The existing `tracker adapter list`, `run --dry-run`, `pause`,
`resume` and `remove` commands also work with `gmail:<rule>` IDs.

Messenger and Telegram can implement the same message-provider contract when
their read-only access is approved. Telegram access is scoped to the
tg-research account.
