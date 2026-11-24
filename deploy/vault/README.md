# Credential Vault browser fixture

This image and the `VaultBrowserDockerAdapter` accept synthetic `.test` origins. The fixture
adapter can use a local `network=none` container or an explicitly selected internal Docker network.
Build it from this directory and use the resulting local image ID for the opt-in test. No image is
pushed. The vendored Docker seccomp policy is from [Playwright 1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json)
under its [Apache 2.0 license](https://github.com/microsoft/playwright/blob/v1.63.0/LICENSE). It
allows the user namespaces needed by the Chromium sandbox. This version also permits the `chroot`
syscall inside Chromium's user namespace. The container does not grant `CAP_SYS_CHROOT` in its
initial namespace.

```sh
docker --context "$fixture_context" build -t harness-vault:fixture deploy/vault
fixture_image=$(docker --context "$fixture_context" image inspect --format '{{.Id}}' harness-vault:fixture)
HARNESS_TEST_VAULT_DOCKER_IMAGE="$fixture_image" HARNESS_TEST_VAULT_DOCKER_CONTEXT="$fixture_context" \
  bunx --no-install vitest run test/credential-vault-browser.e2e.test.ts
```

`recipes/example-console.json` binds the browser script by SHA-256. An ephemeral synthetic reviewer
signs the recipe during the tests. The private executor consumes a sealed password and a separately
sealed SMS or email code, verifies the account and action, and closes the login tab before handoff.
The tests observe provider logout, the security log and its 15-minute recheck on a controlled clock,
and recovery of a browser left by an interrupted supervisor.

The Node-API peer lookup uses `getpeereid` on macOS and `SO_PEERCRED` on Linux. It requires a
supported Node runtime with headers and compiler to build `peer.node`. Bun 1.2.18 does not expose
the accepted socket descriptor. Missing peer credentials fail closed. The fixture runs as one host
user and checks a private lease socket. The macOS relay can grant a separate requester search on its
mode-0700 lease directory and write access on its mode-0600 socket using ACLs. This needs a trusted,
executor-owned mode-0711 runtime directory whose ancestors the requester can traverse. The requester
also needs the lease token and must pass `getpeereid`.

## Local executor setup

In the Harness or Harbor Mac app, open Settings and choose **Set up vault on this computer**.
macOS asks for administrator approval. The same installer is available from the CLI:

```sh
harness vault setup
harness vault status
harness vault remove
```

On macOS, install Colima, Lima and the Docker CLI first. Setup uses the dedicated
harness-vault account and a Colima profile with host mounts disabled. Run Setup or
Repair again after an interruption or if you need to start the engine after reboot.
The private data directory is retained under the root-owned journal's archive on removal.

In a dedicated Linux environment, install systemd, uidmap and matching versions
of Docker Engine and its rootless extras.

The installer starts an executor-owned rootless Docker service. A Linux host where
agents have passwordless sudo still requires a separately controlled Vault VM.

Setup reports local engine readiness. Browser sandbox, requester isolation and
synthetic provider qualification are verified separately before provider use.
The Mac installer can resume journals from the MB2 synthetic executor run.
To qualify the installer in a macOS operator session, run
`bash test/support/vault-setup/macos-smoke.sh`. It uses a fresh temporary account
and private VM profile, checks repair and removal, and deletes its test data.

On MB2, `mb2-cross-user.sh` qualifies the existing synthetic SMS fixture on the dedicated
engine. It runs the fixture supervisor as `harness-vault` and uses the unprivileged system test
identity `_www` to inspect the roster through the actual Chromium lease. The owner UID is refused
even with that attachment. The launcher hashes the reviewed source archive, bundled client and Bun
binary before starting the test processes. The attachment travels over private pipes, and the
temporary files and guest are removed after the run. This fixture exercises the relay boundary.
Enrollment and end-to-end request submission from a real user session have their own acceptance.

## Native approval and legacy wire checks

On macOS, `bunx --no-install vitest run test/credential-vault-ios.e2e.test.ts` compiles the native
Vault sources and checks them against the Harness broker and the standalone broker's synthetic
`vault-add` vector from revision `cd792c0`. The test uses a disposable software signing key and no
Keychain entries. Physical Face ID, pairing and save/reopen are acceptance checks on the iPhone.

## Secret-safe session setup

Run `bash deploy/vault/install-secret-safe-skill.sh` as the session owner to install the
same skill for Codex and Claude. For a managed profile, set its `HOME` or provide its
`CODEX_HOME` and `CLAUDE_CONFIG_DIR` explicitly. The Harness Tracker launcher also
puts the rule at the head of the brief for native and Docker workers. See
[provider recipes](secret-safe-computer-use/recipes.md) for the capture and transfer paths.

Enable transcript detection on a Tracker node by adding `transcriptRoots` to its
existing watchdog configuration. List the actual Codex `sessions` and Claude
`projects` directories, including managed profiles when present. Use absolute paths.
On nodes without a pane watchdog, set `hostEffects.watchdog` to an object containing
only `transcriptRoots` to enable scanning without pane inspection, nudging or recovery.
The scanner reads newly written text in JSONL files named with provider session UUIDs.
It also sees tool output embedded in those records. It never opens screenshot images,
audio, or other binary attachments. Restrict access to transcripts and configure
retention independently.

After enabling, the watchdog records a local starting timestamp and scans files
modified since that point. It maintains byte cursors across restarts and emits one
open rotation task per credential type per transcript. A later occurrence after
closure reopens that task. The Tracker alert carries the
credential type, session UUID and byte position. A managed launch marker can link it
to the source item. Unlinked hits still open a flagged rotation item. Review provider
metadata to identify and rotate affected credentials without reopening the output.
