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

## MB2 account provisioning

The provisioning script is for Daniel to review and run on MB2. Its read-only `plan` mode requires
no sudo. The account is a hidden, non-admin local user with its own group, no login shell or usable
password and an owner-only home. The script creates a separate Docker context in that home. The
context points to a private socket for an independently provisioned engine. The script neither
starts a Docker engine nor points at another account's engine.

```sh
bash deploy/vault/mb2-executor-account.sh plan
sudo bash deploy/vault/mb2-executor-account.sh provision
```

For the journaled MB2 Colima setup that reached `synthetic-checked`, check the dedicated
executor after reboot with `bash deploy/vault/mb2-executor-engine.sh status`. If it is down,
Daniel can run `sudo bash deploy/vault/mb2-executor-engine.sh start`. This starts the existing
no-host-mount Colima profile and checks the dedicated Docker socket and context. Use the same
command with `stop` to restore the stopped state. Do not rerun account provisioning after reboot.
Engine health and the earlier synthetic fixture pass are separate from cross-user acceptance.

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
Keychain entries.

## Paired iPhone qualification

Use a separate development build with bundle ID `com.dafuga.harness.vaultfixture`. Run the local
renderer sync before building in Xcode. Keep the installed Harness app and its pairing intact.
Pair the fixture app with the test desktop using Harness Remote. The desktop's public
`window.harnessRemote.status()` response lists each approved device's `deviceId` and `generation`.
Select the IDs of the fixture app's pairing.

Create an owner-only local directory with a short path such as `/tmp/vaultphone.<suffix>`. Save a
`remote.json` file with the parameters below. Set `HARNESS_VAULT_PHONE_CONFIG` to the absolute path
of that file when launching the test desktop. The `socketPath` must be inside the private directory.

```sh
fixture_dir=$(mktemp -d /tmp/vaultphone.XXXXXX)
```

```json
{
	"phone": "<40 hexadecimal characters from the approved pairing>",
	"generation": 1,
	"origin": "https://vault.example.test",
	"deviceId": "synthetic-native-iphone",
	"socketPath": "/tmp/vaultphone.<suffix>/broker.sock"
}
```

On the iPhone, open **Vault requests** and tap **Show public enrollment key**. Use Face ID, then
save the displayed public key in `public-pin.txt` in the fixture directory. Build the local peer
add-on and the fixture runner in that directory. Use the same local account for the desktop and
the fixture broker for this test.

```sh
bun run --cwd packages/desktop cap:sync
bash deploy/vault/build-peer.sh "$fixture_dir/peer.node"
bun build deploy/vault/phone-qualification.ts --target node --outfile "$fixture_dir/phone-qualification.mjs"
node "$fixture_dir/phone-qualification.mjs" "$fixture_dir/remote.json" "$fixture_dir/public-pin.txt" "$fixture_dir/peer.node" approved
node "$fixture_dir/phone-qualification.mjs" "$fixture_dir/remote.json" "$fixture_dir/public-pin.txt" "$fixture_dir/peer.node" denied
```

Open and review a fresh request for each run, then select the matching decision and use Face ID.
The fixture prints one PASS line after the runner verifies the decision and, for approval, the
sealed test token. The run uses a disposable local broker and contacts no provider. In the Debug
build, use **Legacy test** to review and save a fresh synthetic legacy entry with Face ID. The app
shows a receipt after it reopens the same login from the device-only Keychain.

## Executor admission

Build the CLI and run `credential serve` with `--peer-addon` pointing to `peer.node`. Bun delegates
the native Unix peer check to the bundled Node worker. Add the isolated executor's Ed25519 public
key to the broker trust file under `executors`, an array of objects with `host` and `publicKey`
fields. `credential preflight` returns the public ID of that broker instance. The executor signs the
complete request with that ID, its intended caller UID, the issuance time, and an expiry at most
120 seconds away. It supplies the receipt through `credential request --preflight <file>`. The
broker admits only synthetic HTTPS `.test` requests and limits the offer to the receipt expiry.
The Docker fixture obtains its runner key and signs after its private browser passes the sandbox
check.

To undo, stop the dedicated engine and executor first. The script verifies the account and journal
match, removes their Directory Services records and moves the assigned home out of `/Users`. The
preserved copy is readable only via the root-owned journal at `/var/db/org.harness.vault-executor`.
If either provisioning or undo stops mid-operation, inspect that journal before changing account
records by hand. Keep the executor inactive until the dedicated engine and peer-access setup pass
host preflight.

```sh
sudo bash deploy/vault/mb2-executor-account.sh undo
```

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
