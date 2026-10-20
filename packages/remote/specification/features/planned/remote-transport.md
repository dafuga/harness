# Feature: Remote Transport

## Overview

An approved phone works with the projects of a computer through a relay it does not have to trust. This package is the protocol both sides share: the wire messages (request, response, event), the end-to-end channel (P-256 triple Diffie-Hellman, HKDF-SHA256, AES-256-GCM with strict counters), one-time pairing sealed to the host key, and the host-side session that outlives connections. It runs on WebCrypto only, so the same code serves Electron, a Worker and the tests; the Swift client reproduces its frozen vectors.

## Acceptance Criteria

- Only listed methods exist; a method that a connection may not call is refused before any handler.
- Deployment admission and host-wide activity remain local-only. Remote phones and hosted projects cannot start jobs or list other local projects' deployment activity.
- A mutation is performed at most once per request id: a re-sent id is answered from the ledger, and an id whose answer is gone, or that was issued under another epoch, is refused as expired, never repeated.
- Events carry one increasing sequence per client; a reconnect resumes after the cursor or reports a gap.
- A packet with another key, direction, counter or flag, or any changed byte, ends the channel.
- A pairing request opens only with the host key that hashes to the host id and only with the offer's code; five wrong attempts close the offer.
- `test/support/secure-vectors.json` is produced by node:crypto alone and reproduced by this implementation.
- Over a plain transport a message travels in bounded parts: at most eight multipart messages are in flight, a sender queues the rest, events keep their order, and an empty, oversize, repeated or out-of-order part ends the connection.

## Future Enhancements

- Rotation of the epoch when the spent-id bound is reached, instead of refusing new changes.
