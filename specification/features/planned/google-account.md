---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Harness Google account

The Hub, packaged desktop app and iOS app open on a Google sign-in gate. A verified Hub
account opens Home. Direct links and background project or Tracker reads cannot bypass the
gate. Native users can cancel sign-in or choose existing typed-code recovery.

The Hub remains the Google relying party and identifies the account by Google's verified
subject. Desktop opens the Hub in the system browser with a loopback callback. iOS uses
ASWebAuthenticationSession with a scoped callback scheme and Apple's platform cryptography.
Native code creates an S256 challenge. The browser returns a one-time Hub exchange code
after confirming the Google account, and only the initiating app can exchange it with the
verifier. The native credential stays in platform-protected storage. No Google OAuth client
secret belongs in an app. Same-origin browser checks and per-resource server authorization
continue to apply.

The account menu lists the account's signed-in devices with a name and recent activity.
Removing a device revokes the server session. Tracker overview and replica authorization
must resolve the existing native session to the configured owner. Code recovery remains
compatible with existing clients.

Verification covers anonymous startup, Google sign-in with a synthetic provider, callback
binding and replay, cancel, typed-code recovery, device removal and account isolation.
Hub production requires Daniel's release approval. Sign in with Apple is required by this
release plan before a public App Store submission. Internal TestFlight builds remain with
the macOS and iOS release owner.
