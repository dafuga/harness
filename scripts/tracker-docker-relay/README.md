# Offline Tracker sync through the Harness Docker adapter

This disposable proof runs one real SQLite-backed Tracker spoke push and pull in a Linux
guest. The macOS host accepts the requests over Docker's attached standard streams, adds
TrackerHMAC, and gives the signed requests to an in-process synthetic Tracker hub. The hub
and spoke use independent SQLite journals. The host generates its signing key in memory after
building the guest bundle. The guest receives the hub's status and JSON payload only.

## Run on Docker Desktop

Use a disposable Harness checkout of this branch, a local Docker Desktop Unix socket context
on Apple silicon, Bun 1.2.18, and the existing local Linux arm64 Bun image. This branch is
stacked on #163 at `88ba2105b4aff9011dde706fbbfcd4a7cf149651`. Make the #157 commit
`215f0f57bcf138f4c84da51e88550e52d094db2d` available as a Git object in the checkout
and install the shared lockfile dependencies during setup. The proof itself needs no registry,
model API, provider, live Tracker, or network access.

```sh
git cat-file -e 215f0f57bcf138f4c84da51e88550e52d094db2d^{commit}
bun install --frozen-lockfile --ignore-scripts
bun scripts/tracker-docker-relay/run.mjs sha256:5740a8559c5363061a0cfa8d98c0de664afcce88ed8158eb08b5b6381f137ca5
```

The last command uses `--pull=never` through #163's existing adapter. It extracts the pinned
Tracker sources under a new temporary directory. The small `unsigned-spoke.patch` substitutes an
unsigned transport call at the #157 spoke's signing boundary in that copy. It leaves the spoke's
journal, request serialization, receipt validation, and cursor logic intact. The host mounts
only the generated guest bundle's scratch directory as the task workspace. Existing #163
confinement supplies network mode `none`, nonroot execution, a read-only root filesystem,
all capabilities dropped, no new privileges, and a separate writable `/tmp`.

## What the checks prove

- The synthetic hub rejects a direct unsigned request. Through the relay, the hub accepts two
  host-signed requests and records the expected guest row. The guest imports the hub row and its
  push and pull cursors reach 1 and 2, respectively.
- The host allows one exact synthetic push and then one pull from cursor zero with wait zero.
  The same guest verifies 13 forbidden and replayed requests and one malformed JSON request are
  denied without signing. The tests cover other sync routes, method and query changes, absolute
  targets, caller-supplied authorization, and changes to the operation's node or item.
- The runner inspects the live container's isolation settings and sole bind mount. The guest
  checks its addressed interfaces, files, and environment, confirms the root filesystem rejects
  writes, and checks that replies carry no TrackerHMAC value.
- A second guest runs serially and sends an oversized unterminated frame. The relay aborts before
  signing. The adapter removes both task-owned containers, and the runner checks their absence
  by label and removes the temporary host bundle and journal.

## Compatibility limits

The relay is a one-session fixture with a fixed synthetic node and item. It covers the #157
HMAC and hub handler through an in-process request. Network transit, TLS, long polling,
incremental cursors, retries, concurrent spokes, reconnection, and host restart are outside
the proof.

The entry point uses the #163 Docker adapter directly. It reserves the attached stdin and stdout
for relay frames, so a managed provider using those streams for prompts and output cannot share
this channel. The shipped #157 spoke still expects a local signing key. This fixture adds no
provider auth, egress policy, Tracker cutover, or default runtime integration.
