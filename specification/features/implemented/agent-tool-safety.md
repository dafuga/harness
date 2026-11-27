---
status: implemented
shippedIn: null
unitIds:
  - service.agents-providers-agent-tool-safety
  - module.runtime
owner: harness-safety-layer
reviewedAt: 2026-11-24
---

# Model-independent agent tool safety

Harness brokers effects proposed by a model. The provider, model weights, prompt,
tool description and model output carry no authority. Harbor routes tool calls
from its inference worker through the same broker for every provider and specialty.

## Trust boundary

The host owns agent identity and revision, specialty manifests, explicit user grants,
tool implementations, budget configuration, the reviewer channel and the journal.
The model supplies bounded JSON containing a tool name and arguments. Unknown tools,
invalid arguments, missing declarations, missing grants and unavailable security
dependencies fail closed. The broker is the only model-facing path to a tool.
Provider sandboxes must disable direct tool execution or enforce an equivalent
boundary at the executor. A JavaScript library cannot confine another process.

An adapter binds validated arguments to exactly the effect it dispatches. Its
scope identifier is a canonical resource chosen by trusted code, never a string the
model can supply independently of the action. File adapters must prevent symlink and
path escape. Network adapters must enforce the canonical destination through DNS and
redirects. Shell is always approval-gated and must use an isolated, constrained
runner with no ambient credentials or independent network or write authority. A
specialty declaration and a current owner grant must both cover the action and its
exact scope. Delegated model calls get their own agent identity and grants.

## Admission and review

Reads and independently bounded lookups can dispatch under an explicit scoped grant.
Payments, chain writes, outbound messages, deletes, publishing, deployments, shell
and credential use require explicit approval for every action. A quote or routine
approval for inference does not approve a tool proposed by the resulting model.

For a permitted risky request, record an expiring, one-use challenge. Show the
verified operation and safe details (the actual recipient, destination, resource,
and maximum charge when relevant) in the owner’s authenticated app. The model
cannot submit an approval or choose the display text. Confirmation revalidates
the current policy and content and consumes the challenge atomically with the
dispatch reservation. It binds the agent and revision, exact proposal, resolved
scope, operation, outgoing content and maximum charge. Replay, changes, expiry or revocation deny
execution. The integration provides the original proposal from private host
state, outside the user-visible journal. If the host loses that state, the action
expires and a fresh request is required. A crash after reservation must never
trigger automatic redispatch.

Rate limits apply per agent across accepted tool dispatches in a rolling minute.
Chargeable tools require a host currency and per-action and lifetime maximum in
integer minor units. Reserve the maximum before effects, even for concurrent
calls. Keep reservations when the outcome is uncertain. The adapter must enforce
the reserved maximum at its provider or settlement boundary.

## Content and audit

Messages, published material and artifacts exposed to external recipients require
the specialty’s independent content check. Missing classifiers, classifier
failures and rejected content block dispatch, including after approval. An
application may also require content checks for a specialty's private outputs.
Private replies shown only to the requesting owner and public outputs have
different policies. The classifier receives the exact effect content, and its
reasoning and input stay out of the audit.

Persist requested, held, denied, reserved and result decisions with timestamps,
correlation IDs and fixed reason codes. Do not store payloads, classifier excerpts,
credential identifiers or raw tool errors in the audit. Expose scoped audit and
pending decisions through the authenticated owner surface. The host journal
serializes read, challenge consumption, rate/spend reservation and append in one
durable transaction. Append failure before an effect blocks execution.

## Harbor integration

The worker registers scoped HarborStore reads and Vault signing. It uses the
broker before asking the independent verifier or running the adapter. Its
SQLite journal supports concurrent admission and exposes decisions in the
worker activity trail. Harbor Desktop presents exact signing reviews in the
agent conversation. Phone sandbox integration is tracked separately in h7mbwh.

## Acceptance criteria

- [x] A model stub proposes undeclared tools, ungranted scopes, shell and risky writes.
      Each is denied or held, and effect spies remain untouched until valid approval.
- [x] Approvals reject replay, tampering, expiry, revoked grants and changed revisions.
      Concurrent attempts cannot overbook either a challenge or the agent’s budget.
- [x] Content blocks unsafe outward artifacts and fails closed on classifier errors.
      Journal failures before dispatch prevent effects, and audit entries contain no raw
      payloads, results or exception messages.
- [x] Harbor exercises the broker in its normal test worker with no chain transfers
      and no live provider calls. The owner can see decisions and approve a held action
      through the authenticated app path.
