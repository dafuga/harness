---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Google Device Linking

## Overview

Devices link through one Google account and nothing else. There is no QR code, no pairing link, no typed code and no camera step. Every platform (Mac app, iPhone app, web Hub, Tracker/CLI) signs in with the same Google account, creates its own key pair on the device, and publishes only the public key to the account. A device trusts the other device keys that the account lists, subject to the sealed-data rule below. Private keys never leave the device that made them.

This replaces the earlier QR **Pair a phone** design. The phone has no field for a pairing link, a code or any connection value, and the computer shows no QR code.

## Acceptance Criteria

- Each platform signs in with Google, creates its key pair on first sign-in (Secure Enclave on iPhone, OS-encrypted storage on Mac, WebCrypto non-extractable key in the browser, a 0600 key file for Tracker/CLI), and publishes the public key and a device name to the account. Headless Tracker instances (the box, CI) sign in with the OAuth device code flow, which shows a short code and URL and needs no camera.
- The account lists its devices: name, platform, public-key identity, last seen. A person can revoke any device from the Mac app, the iPhone app or the Hub Devices page. Revocation closes its sockets, denies new connections and, for sealed data, rotates the keys (see `sealed-account-sync.md`).
- Phone access to a Mac needs no approval step beyond sign-in. Selecting an online Mac in the account list opens the connection. The client still proves possession of its device key and the one-time exchange verifier. The Hub binds each request to the authenticated session and the exact host, and ignores any caller-supplied owner. Signing in with another Google subject sees nothing.
- When the Hub browser connects to a linked computer, a temporary network or relay failure while polling leaves the same pairing request pending. The browser checks again within the original 20-second window. Only approval permits a single exchange. Refusal, expiry, cancellation or an elapsed window ends the attempt.
- Sealed data keys are never granted by sign-in alone. A device that signs in shows "Approve this device on your iPhone or Mac". An existing admin device compares the 6-digit code and approves with Face ID or Touch ID, then wraps the keys for the new key. The server only relays public keys and cannot add itself, so Cloudflare cannot read data by listing a key.
- No surface offers a QR code, a camera scanner, a pairing link (`harnessremote://pair`) or a typed code. The Release iPhone app does not ask for camera access. Opening the app with an old pairing link pairs nothing.
- Projects, the agents permission and its downgrade, revocation, and the rule that no change is replayed stay as they were.

## Known Limits

- Google account compromise lets an attacker sign in and publish a key, but not read sealed data without approval from an existing device. Relay phone access to a Mac is gated only by the Google account, as before.
- Devices that stay offline keep working with their existing keys; a revoked key is refused when the device next connects.

## Future Enhancements

- Passkey sign-in as a second factor for adding the first sealed device.
