# Feature: Hub Authentication

## Overview

People sign in to the hosted hub with Google. A project owner proves once, through the dedicated GitHub App, that they administer a repository the app is installed on. The desktop app receives its own revocable session from a signed-in browser without a credential ever appearing in a URL.

The code is reached through `src/lib/server/auth.ts`: `createHubAuth(env, store)` and `createD1AuthStore(db)`. It answers only `/api/auth/*` and `/api/github/*`, and gives project handlers `actor(request)`, `authorizeRepository(actor, repositoryId)` and `token(scope)`.

## Acceptance Criteria

- A Google credential is accepted only with a valid RS256 signature from Google's published keys, an official issuer, this client as the only audience, an unexpired lifetime, a verified email, a subject, and the nonce of a one-time challenge bound to the browser by cookie and CSRF value.
- A Gmail or Workspace account signs in directly. Any other Google account with a Google-verified address gets a pending proof, which is never an actor or a session: it becomes one only by typing an eight-digit code mailed to that address. The code lasts ten minutes, takes five attempts, works once and is replaced by a newer one; sends are capped per minute and per day for the account and the address.
- A proof belongs to one Google subject and one address. A changed address, another subject or a proof older than 30 days needs a new one. An invitation code is never a mailbox proof.
- A logout ends a pending proof and wins against a verification in flight. Without a configured delivery nothing is sent and nothing pretends to be.
- A session is an opaque random value stored as a keyed hash. It arrives as a `__Host-` cookie that is HttpOnly, Secure and SameSite, or, for the desktop app, in the `Authorization` header. An identifier is never a credential.
- A cookie session on an unsafe method counts only with the exact public origin. Logout invalidates the session on the server and every desktop session it approved.
- A desktop handoff is a five-minute, single-use PKCE exchange bound to approver, audience, resource, action, environment and origin. A replay, or a wrong verifier, nonce or resource, issues nothing.
- A GitHub connection is bound to the browser session by one-time state and PKCE. The code is exchanged in a form body. GitHub tokens are stored AES-GCM sealed to the actor.
- `authorizeRepository` asks GitHub on every call: the user's reachable installations, the installation that holds the repository id, and `admin` for that user on that repository. No installation id, owner or name from a client is used.
- A GitHub connection or token rotation that began before a disconnect, or before a newer connection, can never write authority back or return its token: each grant write is one conditional statement on the actor's generation, rotation holds a lease, and a revoked grant stays as a tombstone.
- A request body is read as a stream and cancelled at 16 KiB. Oversized, non-UTF-8 and failing bodies get the same opaque error.
- Installation tokens are minted with an RS256 app JWT of bounded lifetime, for explicit repository ids and `contents` only. Write exists only for the configured collaboration repository. No route returns a token.
- Without configuration the hub reports itself disabled, authenticates nobody and issues no token.
- One-time records are claimed in a single SQL statement, so concurrent attempts succeed once.
- No provider message, token, key or secret reaches a response.

## Future Enhancements

- Sign out every session of a person at once.
- A loopback redirect for the desktop handoff, which would bind approval to the same machine.
