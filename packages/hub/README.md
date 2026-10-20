# Harness Hub

Hosted collaboration for Harness projects. People sign in with Google and see projects they own alongside projects they have joined. Owners can invite readers, commenters or writers. Writers may request agent changes from Web, Electron or iOS; comments remain human discussion. Each client uses the same server-side membership checks.

## Local development

From the repository root run `bun install --backend=copyfile`, then `bun run --cwd packages/hub dev` (127.0.0.1:5798). The existing embedded `/harness` and desktop preview ports stay separate.

The checked-in Wrangler names and zero database id are local placeholders, not registered cloud resources. Authentication remains disabled without dedicated provider settings and the auth database. Synthetic tests do not need provider credentials.

## Provider setup

Create a dedicated Google web client for this product/environment. Register the exact hosted origin in Google Identity Services. Create a dedicated GitHub App with read contents for connected source repositories and write contents for one private collaboration repository; its callback is `{origin}/api/github/callback`. Owners prove GitHub admin access before connecting a source repository. Invited Google users need no GitHub login.

Set project-owned secrets through the host secret store: `HARNESS_GOOGLE_CLIENT_ID`, `HARNESS_SESSION_SECRET`, `HARNESS_GITHUB_APP_ID`, `HARNESS_GITHUB_PRIVATE_KEY`, `HARNESS_GITHUB_CLIENT_ID`, `HARNESS_GITHUB_CLIENT_SECRET`. Set `HARNESS_PUBLIC_ORIGIN`, `HARNESS_ENVIRONMENT`, and the collaboration repository owner/name/id/installation id. Never put reusable credentials in URLs or tracked files.

The example `.env.example` lists settings without credentials. Gmail and Workspace accounts can sign in directly. Other Google accounts first prove their current mailbox with a single-use code; configure dedicated Resend `HARNESS_EMAIL_API_KEY` and `HARNESS_EMAIL_FROM` to deliver it. Codes expire after ten minutes and are entered on the sign-in page. Pending identities cannot open projects or approve desktop access. Invitations still use separately copied links and codes; creating one sends no email.

Bind D1 as `DB` for ephemeral sessions/challenges/native handoffs and R2 as `CACHE` for rebuildable projections. Apply every SQL file in `db/migrations` through the target environment's normal migration command. Before publication replace local resource placeholders and origin/environment with verified dedicated resources; production publication requires explicit approval.

GitHub stores source, contracts, designs, notes/evidence and the private collaboration records. The `harness-collaboration` branch bootstraps a records-only root commit on the first authorized project creation. Membership and invitation codes never enter public source repositories. Codes are hashed, email-bound, expiring and single-use; links contain only a nonsecret invitation id. The UI copies a link and code separately and does not send email.

## Paths

- `/`: sign-in and authorized project list.
- `/projects/{projectId}/harness/branch/{encodedBranch}/{pages|components|functions|configs|services}`.
- The same branch path with `/commit/{fullCommit}` before the category.
- Append `/{entityId}`, `/{entityId}/history`, or `/{entityId}/details` for an entity; source remains inside Details.
- `/invite/{projectId}/{invitationId}`: Google sign-in and invitation-code acceptance.
- `/projects/{projectId}/members`: membership and invitations.
- `/native/{handoffId}`: approve a one-time device session; no reusable credential in the URL.

Google sessions identify people by verified issuer/sub. GitHub authorization, membership and media access are checked server-side. Caches bind principal, project, repository, requested ref, source commit/tree, notes/evidence revisions and artifact hashes; corrupt data is discarded. Cache deletion never deletes GitHub records or local pending drafts.

R2 stores disposable source/media bytes and rendered snapshot/entity/history projections. Current GitHub heads and membership are read before a cached projection is used; comments are refreshed independently. Electron keeps its own disk cache, shows its saved timestamp while offline and disables shared mutations. Denied access purges protected cached views. An unavailable cache can be rebuilt from GitHub.

## Electron connection

Launch the Electron workspace with the exact trusted `HARNESS_HUB_ORIGIN`. Connect prompts a browser sign-in and one-time code approval. PKCE verifier and bearer session stay in the main process; the session is encrypted using Electron safeStorage. Owned and accepted-invitation projects use the same Google account across devices. Readers can browse, commenters can discuss, and writers can request agent work where the project capabilities allow it. The server checks those rights on every operation; a completed chat run is not a verification result.

## iOS account connection

Set the public `HARNESS_HUB_ORIGIN` build setting to the same exact HTTPS Hub origin used by Web and Electron. The app keeps its bundled renderer and opens the hosted Google approval page in Safari. Its account credential stays in a separate device-only Keychain namespace, outside the JavaScript bridge. No Google client secret belongs in the mobile build. An unset or invalid origin disables the account lane; it does not enable arbitrary host selection.

A phone can open owned or joined hosted projects without a paired Mac. A paired Mac may additionally provide explicitly granted local projects. Removing a pairing leaves the independently authorized Google account intact. Temporary Hub outages do not authorize writes; the iOS hosted lane does not promise a persistent offline project cache.

## Remote hosts

The desktop of a signed-in owner registers its Mac for phone access with `POST /api/remote/hosts` and manages it with `GET` or `DELETE /api/remote/hosts/{hostId}` and `DELETE /api/remote/hosts/{hostId}/devices/{deviceId}`. The owner is always the verified session, never a request field, and every call is forwarded to the relay's per-host Durable Object through the `REMOTE_HOSTS` binding. Without that binding or `HARNESS_RELAY_ORIGIN`, the relay's exact origin, these routes answer `503 remote-disabled`. This paired-Mac lane is separate from the phone's Google account connection. Pairing grants only the explicitly approved local Mac projects; hosted projects still require the phone's own verified account and membership.

## Validation

`bun run check:collaboration`, `bun run check:hub` and `bun run check:desktop` are included in the root check. Security tests use generated keys and synthetic provider/HTTP fixtures, without live credentials or invitations. Browser/native screenshots are external evidence and are not committed. Live provider registration and authorized hosted publication are separate acceptance layers.

The browser suite (`bun run --cwd packages/hub test:e2e`) starts its own preview on `127.0.0.1:5795` and refuses a server that is already there; it never uses the development server on 5798. `HARNESS_HUB_TEST_PORT=<port>` names another free port from 1024 to 65535.
