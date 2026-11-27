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
`navigator` property, adds no stealth extension and solves no captcha. The reader
uses a private DevTools pipe. The viewer uses that same pipe for navigation,
and the adapter asks Chromium to shut down with `Browser.close`. A site's
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

The paired viewer shows Back, Forward, Reload, Home, and a URL field above
the remote screen. Commands apply to the focused Chromium page, including
popups. Home opens a blank page. The URL field accepts HTTP and HTTPS addresses
and starts empty so the viewer chrome never copies an address from a remote tab.
Navigation accepts same-origin POSTs with live device approval.

For use outside the private network, a Cloudflare Tunnel on the browser's Mac
forwards to loopback. Its exact hostname is protected by an Access application
that admits only Daniel's configured identity. The viewer verifies the issuer,
audience, identity and expiry before issuing a device code, serving the viewer,
or opening a screen socket. Device approvals and Access sessions expire in
15 minutes in this mode. The screen socket closes when either expires.

On Hub Home, an open Needs You item that includes the canonical viewer
address can open a detail dialog. The dialog opens the protected viewer as a
top-level browser tab so that Cloudflare authentication works across devices.

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

### MB2 Cloudflare route

- Create the self-hosted Access application before publishing DNS. Attach one
  Allow policy matching Daniel's exact email and set both session limits to
  15 minutes. Pin the application's audience and team in both the gate and
  the Tunnel ingress.
- Run the dedicated connector on MB2. Match only the viewer hostname, set
  `httpHostHeader` to that hostname, forward to `http://127.0.0.1:6080`, and
  require Access. The final ingress rule returns 404. Keep the tunnel
  credential in an owner-only file created on MB2.
- Start the viewer on MB2 with `--profile x --access-host browser-viewer.novaylo.com`
  and its `--access-team`, `--access-audience`, and `--access-email` flags. Pass
  the canonical `https://browser-viewer.novaylo.com/` address as a standalone
  token in the open Tracker ask that needs a browser.
- Run `container-browser approve <code> --profile x --directory ~/.harness/container-browser/x/cloudflare`
  on MB2 to admit the remote device. Use the same directory with `revoke` to
  end remote control without clearing the private viewer's paired devices.
- Verify an unsigned browser reaches Access and a signed-in, unpaired device
  reaches the pairing page. Verify navigation after approval from a separate
  computer before retiring the temporary SSH forward. The Chromium container
  and its profile stay in service when the viewer process is replaced.
- To roll back, remove the dedicated DNS record and stop the MB2 tunnel agent.
  Restore the prior MB2 viewer LaunchAgent and keep or restore the temporary
  forward. Roll the Hub site's deployment back through its own release path.

## Proof

`HARNESS_TEST_CONTAINER_BROWSER=1 bunx vitest run test/container-browser.e2e.test.ts`
runs a throwaway profile in a real container: no published port, a VNC greeting
over the pipe, and the page scripts reading a fixture over DevTools.
