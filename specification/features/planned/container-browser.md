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

## Private entry

Tracker `9z0dtppezb` covers private entry on MB2 and the primary Mac. The same
entry flow is intended for Azure (`ybp5be`) and later sign-ups. It requires
isolation before use with real cards, passwords or identity documents.

- **Default entry.** The agent requests an approved card or password field.
  Harness on iPhone or Mac shows the website and action in its Credential Vault
  form. Daniel confirms on the device with biometrics. Reuse the Vault’s enrolled
  device proof and sealed delivery. Bind the approval to the executor, request,
  tab, exact origin, reviewed field and action, and an expiry. A script in the
  executor fills and submits. Daniel can opt in to saving supported values in
  the Vault. Without that choice, the payload is transient. Hub web is later.
- **Optional viewer.** The Tracker ask links to the viewer without a credential
  in the URL. Only the paired viewer can see or type into the private form over
  a verified encrypted connection. Its Done action is authenticated and bound
  to that request. The agent has no Done action.
- **Isolation.** The executor owns the browser, VM, volumes, gate and private
  endpoints. Agent processes run as an unprivileged OS user without access to
  the executor account or a way to invoke sudo as that account. The primary Mac
  needs a protected browser, since its existing loopback debugging port is
  visible to local agents. The MB2 X profile and viewer require their own
  coordinated cutover after the current X sign-in work.
- **Handoff.** Acquire the private window before accepting input and revoke
  existing agent connections and in-flight reads before it starts. Deny
  screenshots, DOM, accessibility, DevTools, recording and logs during it.
  Done or successful script submission permits resumption only after the
  executor closes the form tab and verifies an approved result page. Cancel,
  expiry, crash or failed cleanup keeps agent access closed until disposal.
  The agent receives only a status receipt.
- **Browser storage.** Use a fresh protected profile. The Chromium image
  installs mandatory password saving and autofill restrictions for contact,
  payment, and identity data. Verify the effective policies in each installed
  browser before enabling private entry.

### Acceptance for private entry

Use synthetic values. On each Mac run the probes under the real agent UID
before, during and after entry. Prove already-open sessions cannot read, and
that Docker exec, VM sockets, volume reads, CDP and screen access are denied.
Check that a copied request identifier, a different viewer, an expired approval
and an agent caller cannot finish the window. Exercise cancellation, expiry
and executor restart. Confirm the form is gone before agent reads resume.
Inspect allowed output and persisted artifacts for synthetic values and private
URLs. Exercise the installed iPhone and Mac forms and the optional viewer on
Daniel's paired devices. Record the browser, app and host versions and the
effective saving policy per host.

## Proof

`HARNESS_TEST_CONTAINER_BROWSER=1 bunx vitest run test/container-browser.e2e.test.ts`
runs a throwaway profile in a real container: no published port, a VNC greeting
over the pipe, and the page scripts reading a fixture over DevTools.
It also checks the active saving policies reported by Chromium.
