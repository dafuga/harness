# Persistent project chat and access levels

Status: planned

The round project-chat bubble is always available on catalogs, entity pages, history,
and read-only views. Its panel retains the conversation while navigating within a project.
Write users can choose a discovered model and ask questions, plan work, or request code
changes. Comments remain human messages. Agent output and observed changed files name
registered units through clickable links to each unit’s scoped History page.

Access levels are Read (browse), Comment (browse and comment), and Write (browse,
comment, AI requests). Owners retain member-management authority. Server-side permission
checks, not renderer flags, decide. Local trusted owners have Write. Paired devices and
hosted memberships use the same levels; prior Comment grants retain Comment access.
Hosted Write execution requires an explicitly configured project executor. An unavailable
executor is stated honestly; it never falls back to another project or machine.

The standalone local web explorer mounts the same chat UI and a loopback-owner backend.
Every mutation requires same-origin request validation. Historical/stale and cross-project
writes remain refused, and AI never starts for Read or Comment users. No credentials or
bearer tokens appear in URLs. Existing Plan/design approval flows remain intact.

## Coverage gap

Existing tests deliberately hid project chat on entity/pinned/hosted views, covered only
creation prompts, and asserted universal hosted execution denial. Extend those standard
scenarios for bubble visibility, permission levels and scoped history links. Extend role
access and executor boundaries for writer membership, forged roles and revocation.
Native Electron/iOS UI testing stays paused; test the shared renderer and backend adapters.

## Verification boundaries

The local web preview uses the real desktop run service behind its loopback owner guard and same-origin JSON checks. Chat connects lazily. Read-only questions report any unexpected writes. Shared hosting accepts Write requests only through an explicitly configured project executor; no production executor or Google deployment is configured by this change. Native UI checks remain paused.

The first broad desktop unit run found legacy assertions that deliberately required the launcher to disappear. Those assertions will be aligned only after the unchanged red/green regression checkpoint. The running preview also retains stale SvelteKit route-node numbering after external sync; fresh fixture servers verify source routing while this existing server awaits an authorized refresh.
