# Feature: Relay Host Object

## Overview

A computer and its approved phones meet at a relay without an inbound port on the computer. One Durable Object per host forwards sealed packets between the host socket and device sockets, keeps hashes of credentials and one-time pairing offers, and nothing readable. Management (registration, summary, revocation, removal) is reachable only through a namespace binding of the hub, which names the verified owner; the public Worker answers `/manage/*` with 404.

## Acceptance Criteria

- The public Worker forwards only the pairing routes and the WebSocket connect of the contract.
- A socket opens only for a bearer whose bound hash is stored for that role, host and device; a credential in the address is ignored and a browser origin is refused unless listed.
- A pairing is exchanged once, with the verifier of its challenge, and yields the only copy of the device credential.
- A host packet reaches exactly the connection it names; a packet for a closed or revoked connection is dropped.
- Revocation closes the device socket with 4401 and its credential is refused afterwards.
- Frames beyond the bound, malformed frames and floods close the socket; nothing is logged.

## Future Enhancements

- An index of the hosts of one owner, for a hub page that lists them.
- Idle closing of sockets that stopped answering.
