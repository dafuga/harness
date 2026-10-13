# Feature: Runtime Evidence Contract

## Overview

The shared viewer of the desktop app, the hosted Hub and the phone reads recorded runtime evidence
of one entity through two optional bridge operations, `evidence` and `artifact`. Evidence is what
verification captured from running software. It is kept apart from planning designs: other
operations, other types, and a capture is named by its binding, never by a path or an address.

## Acceptance Criteria

- `evidence` answers one entity at a branch tip (`current`, one side) or at a commit compared
  with its exact first parent (`commit`), with the scope, the identity it was read at, and the
  evidence and behaviour that the reports functions compute.
- `artifact` answers the checked bytes of one capture that an evidence answer named, bound to
  the project repository, the source tree, the pinned notes and evidence revisions, the sealed
  record, the scenario, state and side, and the hash.
- A backend that cannot serve them leaves the operations absent; an input keeps exactly the
  contract's fields.
- Unrelated captures, corrupt records or hashes, wrong revisions, missing records and missing
  parents are refused or reported as gaps, locally, hosted and over the remote transport.
- The local reader captures the selected project before asynchronous work. Hosted readers
  check project membership before loading and before returning, and scope cached data to the
  principal, project, source revision and immutable history pins.
- Artifacts are limited to 11 MiB of raw bytes and metadata to one 16 MiB transport message.
  MIME types are attested against the bytes and returned hashes are checked again by the viewer.
- Hosted record validation releases capture buffers sequentially and retains validated file
  facts. A response-size limit does not establish total Worker memory consumption; that
  measurement remains unavailable.

## Future Enhancements

- Artifacts larger than one transport message.
