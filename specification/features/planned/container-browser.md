---
status: planned
shippedIn: null
unitIds:
  - command.execution-runtimes-container-browser
  - adapter.execution-runtimes-container-browser
  - adapter.execution-runtimes-container-cdp
  - service.execution-runtimes-container-viewer-gate
owner: null
reviewedAt: null
---

# Container browser

`harness container-browser` runs a full, headed Chromium on a virtual display in
a local Linux container, for sites that refuse headless browsers. Nothing is shown
on the Mac's screen. Each profile keeps its own sign-in in a Docker volume.

## Not a disguise

The browser is stock Debian Chromium. Harness sets no user agent, patches no
`navigator` property, adds no stealth extension and solves no captcha. It reads
through DevTools with `Page.navigate` and `Runtime.evaluate` only (and
`Browser.close` to shut it down). A site's
"verify it is you" step is a question for the owner, never something to work
around. A site's own rules on automated access still apply.

## Confinement

- A dedicated Colima VM, `harness-browser`: 2 CPUs, 4 GB, 20 GB disk, no mounts
  of the Mac, and the active Docker context and SSH config are left alone.
- The container has no capabilities, `no-new-privileges`, the Chromium sandbox
  seccomp profile from `deploy/vault`, 3 GB of memory and **no published port**.
- VNC and DevTools listen on the container's own loopback. The host reaches them
  only through `docker exec` pipes, so DevTools has no network address at all.

## Viewer

`container-browser viewer` is the only listener. It binds `127.0.0.1`. Where a
Mac runs Tailscale in userspace mode, the tailnet forwards to loopback, so the
owner's tailnet devices can open it with no Tailscale or SSH change; the local
network and the internet cannot. Traffic between devices is encrypted by the
tailnet; the page itself is HTTP.

An unapproved device sees only a six digit pairing code. Running
`container-browser approve <code>` on the host admits the one browser showing it.
The code is not a secret, so it can travel through a chat or the tracker. Only
cookie hashes are stored, in an owner-only file. `revoke` removes every device and
drops connected ones within five seconds. Requests with another Host name, and
screen sockets from another origin, are refused. Anything able to run commands as
the host user can already reach the container, so approval is not a boundary
against that user.

## Commands

```sh
harness container-browser setup --profile x --disk-image <colima image>
harness container-browser viewer --profile x --host <tailnet name> --host <tailnet ip>
harness container-browser open https://x.com/i/flow/login --profile x
harness container-browser approve <code> --profile x
harness container-browser status|down|revoke --profile x
```

`setup` caps its package download (`--download-kbps`). `down` asks the browser
to quit, which saves its cookies at once, then removes the container and keeps
the saved profile. A stop without that (for example a restart of the Mac) keeps
every cookie older than the browser's periodic save, about 30 seconds.

The screen is portrait (600×1100), so a sign-in can be finished from a phone.

## Google and Slack in a protected profile

The opt-in `protected-chrome` image target uses Google's ARM64 Chrome Stable.
It runs on the same virtual display with a dedicated `google-slack` volume.
Chrome starts without DevTools flags. Managed policy disables remote debugging,
browser-account sync, and credential and autofill saving. Google website sign-in
is still available. The existing X collector uses the default Chromium target.

Connect the Chrome target to the executor and paired phone viewer from
Tracker items `9z0dtp` and `qs1qgx` before using a real account. Keep the
engine socket, display, and profile under the executor identity. The legacy
viewer is unsuitable for sensitive entry because its host user can access
the display and Docker socket.

Keep the dedicated Colima disks on the executor Mac's FileVault-enabled Data
volume under the private executor home. Verify the actual disk paths and
FileVault state before enabling admission. A Docker volume persists the profile
and relies on host disk encryption for protection at rest.

The private executor uses the `harness-google-chrome` Colima profile with VZ,
no host mounts, and no shared Docker context. Name the container
`harness-browser-google-slack` and its volume `harness-browser-google-slack-profile`.
`python3 protected-chrome-executor.py verify-storage` validates the actual VZ disk files
and owner-only home and socket. This runs under `harness-browser-executor`.

For initial sign-in and reauthentication, the executor drains agent work
before opening the private viewer and requires Daniel's paired device.
Daniel signs in to the Google website and completes any Google challenge on
that device. After Done, the executor revokes viewer input, closes the
sensitive view and verifies the result before admitting reviewed screen
actions in the virtual display. If Google asks for reauthentication during
Slack's Sign in with Google, return to private takeover. Preserve the dedicated
volume through restarts. A rollback stops the separate Chrome container and
revokes its viewer session while retaining the volume.

The Google session check runs in the executor with other browser work and
viewer input excluded. It opens the Google Account security page in a separate
Chrome window in the same profile and reads only the destination via Linux
accessibility. It closes the window before returning `ready`, `reauth-required`,
or `unknown`. No account contents, cookies, full URLs, or WebDriver or DevTools
traffic are part of the check. An unrecognized page or unavailable network is
`unknown` and holds admission until a safe result is verified.

Run `python3 protected-chrome-executor.py health` inside the executor's exclusive
reviewed operation after private input is closed. Also run it before queued
Google-dependent work to detect an expired session. Route verified outcomes to
`python3 protected-chrome-executor.py report STATUS TRACKER_EXECUTABLE TRACKER_ITEM`
using the installed Tracker binary and the operator-selected monitoring item.
The reporter alerts Chief of Staff once after an observed healthy session
expires. It retries delivery on failure and waits for a new healthy session
before alerting again. The executor should leave work paused until the private
viewer completes reauthentication and the check returns `ready`.

For acceptance, confirm the actual Google sign-in succeeds through the phone
viewer, then use Slack's Sign in with Google in the same virtual desktop.
Check that the intended Slack workspace opens through the admitted executor
path, including after the container is recreated with its existing volume.
Record sanitized outcomes without capturing either sign-in page.

## Proof

`HARNESS_TEST_CONTAINER_BROWSER=1 bunx vitest run test/container-browser.e2e.test.ts`
runs a throwaway profile in a real container: no published port, a VNC greeting
over the pipe, and the page scripts reading a fixture over DevTools.

For the Chrome smoke test, use a disposable ARM64 Docker engine on MB2.
Build `deploy/container-browser` with
`--target protected-chrome --tag harness-protected-chrome:test`, then set
`HARNESS_TEST_PROTECTED_CHROME_SOCKET` to that engine's Unix socket and run
`bunx vitest run test/container-browser.e2e.test.ts`. The test disables
networking and checks the virtual screen and absence of a debug listener. An
in-container HTTP fixture verifies a website session is retained after container
recreation and distinguishes an expired session from a network failure.
