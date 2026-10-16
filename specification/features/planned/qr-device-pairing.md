# Feature: QR Device Pairing

## Overview

A phone is paired by scanning. The person chooses **Pair a phone** in Harness on the computer, which shows a QR code; the phone app scans it with its camera; the computer then shows the named phone with the identity of its key, and the person approves or denies it there, choosing the projects and the agents permission. The phone has no field for a pairing link, a code or any connection value.

The protocol underneath is the one that existed: one open offer, a request sealed to the key of the computer, a challenge, an approval sealed to the exact key that asked, one exchange. Only the way the one-time offer reaches the phone changes.

## Acceptance Criteria

- The QR code holds exactly one offer and nothing else: version, audience, environment, expiry, the identity of the computer, the pairing, the one-time code and the exact relay origin. No host, session, API or device credential is ever part of it.
- An offer is read by one rule in TypeScript and in Swift: only the exact text the computer writes is accepted, within a fixed length, for this version, audience and an environment the build accepts, before it expires and never further ahead than an offer can live. Shared vectors prove that both sides agree.
- Electron shows the QR code with the time it has left, and lets the person make a new code or withdraw it. A new or withdrawn code stops the earlier one, on the computer and at the relay. An expired code is not shown as one that can be scanned.
- The phone offers **Scan QR code**. Camera access that was refused, a scan that was cancelled, a code that is not an offer, one that expired, and one for another version or environment each say what happened and can be tried again. Nothing is sent before a valid offer was scanned.
- Scanning does not connect. The phone waits for approval; only an approval for its exact key, with the projects and permission the person chose, is exchanged for a connection. Denial, expiry and a used offer leave it unpaired.
- Projects, the agents permission and its downgrade, revocation, and the rule that no change is replayed stay as they were.
- The Release app has no way to hand a code to the scanner other than its camera. A synthetic scan exists only in an isolated test copy.

## Known Limits

- A simulator has no camera: the native decoder and the scan boundary are checked on the Mac, and the camera path is proven only by a native build and a real device.
- The pairing link (`harnessremote://pair`) is removed with the fields it filled. Opening the app with a link pairs nothing.
- The QR symbol is made by the pinned package `qrcode` 1.5.4 behind one small renderer contract; this repository holds no QR algorithm of its own. Tests read the drawn symbol back with an independent decoder (`jsqr` 1.4.0, tests only).

## Future Enhancements

- Opening iOS Settings from the camera-refused notice.
