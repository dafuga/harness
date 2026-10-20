# Preserve ownership when sharing the account client

The full root unit suite found that the portable bridge extraction left four
historical migration records pointing to forwarding files. It also found that
the shared workspace's strict dependency expectations predated account refresh.

The existing workspace-registry test now names the refresh and cache-status
imports explicitly. Its exact graph assertions remain. The existing unit-index
test still requires all 411 moved helpers to retain definition hashes, local
owner folders and stable registered identities; no exception is added.

Private comment and artifact functions move beside the portable bridge. Their
old public exports continue forwarding. Four migration records retain their
previous paths and identify the bootstrap repair that prompted this relocation.
The original function hashes are unchanged. The public and registered owner
entries of the bridge, comment mapping and artifact validation each execute in
fresh Bun processes, avoiding a warm module graph.

Test-only `7a1624a6` records failing checkpoint `789cb3a8` before this repair.
The unchanged proof command includes the 15 root registry/unit-index tests,
Desktop account/boundary checks, Hub session/cold entries and all 11 hosted
account browser cases. Live Google and physical device acceptance remain
separate configuration-dependent gates.

The separate repair is `7f848772`, passing unchanged clean checkpoint `f3eef9d7`:
15 root registry/migration checks, 41 Desktop account/boundary checks, nine Hub
session/cold-entry checks and 11 browser cases. All public and owner calls pass.
No migration definition hash was relaxed, and no fixture assertion was removed.

Final root unit rerun: 889 passed, 25 skipped. The Web and iOS simulator builds,
Hub type checking and all 11 fresh browser cases pass. Full verification remains
pending for the Desktop fixture type error, Hub controller lint debt and live
account configuration documented in the parent account-sync loop.
