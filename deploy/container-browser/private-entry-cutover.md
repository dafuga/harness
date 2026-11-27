# Managed browser cutover

Tracker item `9z0dtppezb`. The existing MB2 X browser and the primary Mac’s
automation Chrome serve their current workloads until Daniel schedules each
cutover. Private entry remains disabled until installed acceptance on both Macs
and Daniel’s paired iPhone.

## Operator, executor and agent identities

Create a dedicated non-admin `harness-browser-executor` and a distinct non-admin
`harness-browser-agent` on each Mac. Record the local UID and primary GID of each
in the deployment journal and pin the UIDs in the service definitions. Reject an
executor or agent UID equal to the operator, root or each other. Both service
accounts use non-interactive shells. The operator owns the service definitions
and controls their activation.

Use separate owner-only homes. The agent owns its worktrees and job outputs.
Operator-owned launch files, dependencies, reviewed recipes and service code
are readable executable inputs to the services, with write access reserved to
the operator. The executor owns its browser profile, private scratch, VM,
Docker socket and private display. Keep the one agent API socket in a
searchable runtime directory where the agent has no write access. Grant socket
access to a dedicated group and require the kernel-reported UID on every call.
No group grant applies to browser resources or control endpoints.

Inventory current Tracker jobs, SSH and provider access. Re-enroll only each
job’s approved access. Do not copy cookie stores, profile files, keys or other
credential material. Check local admin and sudo policy, remote login, screen
sharing, Apple Events, Accessibility, Screen Recording and privileged helper
access for the exact job identity before admitting work.

## Host inventory and proof

On each host, collect these read-only checks under the operator identity.
Inspect service definitions by label and record only installed revision, label,
owner, executable and route facts. Keep credentials and credential-bearing
configuration out of the journal.

```sh
scutil --get LocalHostName
id -u danielfugere
id harness-browser-executor
id harness-browser-agent
dsmemberutil checkmembership -U harness-browser-executor -G admin
dsmemberutil checkmembership -U harness-browser-agent -G admin
```

On MB2, fingerprint the legacy collector, viewer and runtime before planning
activation. The last observed collector revision was
`6ab983c332b2ac7b4ae5b06195e6323aa1a119d4`.

```sh
launchctl print gui/501/com.harness.x-digest.viewer | awk '/^[[:space:]]*(state|pid) = /'
launchctl print gui/501/com.harness.x-digest.daily | awk '/^[[:space:]]*(state|pid) = /'
sed -nE '/^[0-9a-f]{40}$/p' ~/.local/share/harness-x-digest/app/INSTALLED_SHA
stat -f '%u %Lp %N' ~/.colima/harness-browser/docker.sock
```

Use a separate executor-owned Colima VM, engine socket, browser image and
fresh X profile. Keep the existing `harness-vault` test executor separate.
Use the paired viewer route from `qs1qgx` once verified. The collector must
still send through the primary Mac sender. Update only its viewer link after the
new route is proven.

On the primary Mac, fingerprint the automation Chrome and sender before
planning activation.

```sh
launchctl print gui/501/com.daniel.automation-chrome | awk '/^[[:space:]]*(state|pid) = /'
launchctl print gui/501/com.harness.x-digest.sender | awk '/^[[:space:]]*(state|pid) = /'
lsof -nP -iTCP:9333 -sTCP:LISTEN
```

Qualify a separate Chrome for Testing instance with a fresh profile, an
executor-private debugging pipe and an offscreen renderer. Rehearse startup
and reboot under the executor service and inspect effective managed policy.
Inventory Tracker’s 9333 launch rule, `automation-signin`, health probes and
job callers. Move reviewed browser reads to the broker. Give legitimate
arbitrary-CDP test jobs their own disposable browser. Preserve Daniel’s
everyday Chrome session.

## Qualification for scheduling

Use an isolated synthetic site and a disposable profile. The test driver must
run as the exact installed agent under its launch configuration. Run an
executor-side positive control on each resource first to rule out a broken
fixture. Run the agent-side probes before, during and after private entry.

| Resource                             | Agent probe and expected result                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Other identities                     | Group and sudo eligibility checks are negative. A non-interactive command as the executor and a local remote-login attempt are denied.                                                                          |
| Executor home and persistent profile | Cannot traverse the private home, read the profile or inspect the volume or VM state.                                                                                                                           |
| Docker                               | Explicitly targeting the verified executor engine fails for both engine status and container exec.                                                                                                              |
| DevTools, viewer and the display     | Cannot open the endpoint or pipe, use the viewer URL without pairing, hook the executor or capture its display.                                                                                                 |
| Deployment                           | Cannot write installed code, recipes, service definitions or their parents, change launch services or route traffic.                                                                                            |
| Agent API                            | Status, private-entry request and the reviewed read work outside takeover. A pre-opened read aborts and drains. Reads and screen, DOM, accessibility, recording, logs and Done are unavailable during takeover. |
| Recovery                             | Cancel, expiry and executor restart refuse reads until the form is gone. A failed result check keeps admission closed.                                                                                          |
| Native and viewer                    | The enrolled Mac and iPhone default to the sealed field form. The optional paired viewer can submit and finish. Another device, a copied identifier and a stale proof cannot finish.                            |
| Storage                              | Effective password, payment, contact and ID saving controls are enforced. Synthetic canaries are absent from agent output, URLs, profile artifacts, console diagnostics and captures.                           |

The agent API accepts no request body. It uses `GET /status`, `POST
/private-entry` and `POST /read` over a Unix socket. The executor config binds a
reviewed read and a paired device to that admission surface. Device requests
travel through the enrolled Vault path.

After the candidate binds the Unix socket, run these commands inside the
installed agent job. The job supplies `PRIVATE_BROWSER_AGENT_SOCKET` from its
operator-owned launch configuration. Record status codes and reviewed
receipts only.

```sh
curl --unix-socket "$PRIVATE_BROWSER_AGENT_SOCKET" http://localhost/status
curl --unix-socket "$PRIVATE_BROWSER_AGENT_SOCKET" -X POST http://localhost/read
curl --unix-socket "$PRIVATE_BROWSER_AGENT_SOCKET" -X POST http://localhost/private-entry
curl --unix-socket "$PRIVATE_BROWSER_AGENT_SOCKET" -X POST http://localhost/finish
```

The read must return HTTP 409 during private entry. The agent’s Done request
must return HTTP 404. Test a paired device’s Done separately through the
viewer.

A signed native delivery binds the
executor, request, tab, HTTPS origin, reviewed field and action, recipe digest,
runner fingerprint and expiry. The optional viewer authenticates the paired
device and authorizes Done for the exact active request. Its link contains no
credential.

Before leaving private mode, revoke and drain viewer input and background
operations. Close the private tab, confirm it is gone, then verify a separate
reviewed result page. On restart, all admission starts closed. The executor
must account for restored tabs before admitting a read. Agent receipts contain
only status and the request identifier. Treat only a completed receipt for the
same request as permission to continue the interrupted workflow. Keep recording and content logging
disabled along the entire private route.

## Activation windows and rollback

Propose a supervised MB2 window after qualification. Pause admissions for MB2
and preserve the legacy launch definitions, installed revisions, outbox
configuration and profile under their existing owner. Switch the collector and
viewer routes only after the new executor and agent UIDs match their pins.
Schedule Daniel’s fresh X sign-in if needed. Verify Following, For You and
mentions, the scheduled collector, the primary sender and its receipt before
proposing the primary window.

In a separate primary window, preserve `gui/501/com.daniel.automation-chrome`
and `gui/501/com.harness.x-digest.sender`. Confirm the new approved browser
consumers and health path before opening admission to the new agent. Before
admitting real work, stop the legacy 9333 listener and verify the new agent
cannot connect. Retain its launch definition for rollback.
Read back browser, executor, agent, Mac app and paired iPhone app versions. Use
only synthetic fields for installed native, viewer and result-page acceptance.

If anything fails, close private admission first. Confirm the private form and
any partial delivery are disposed. Revert only the active host’s job routes to
its preserved legacy launch definitions. For MB2, restore the collector and
viewer and check the legacy X smoke when signed in. For primary, restore the
9333 service and check its ordinary consumers and the independent sender.
Verify that the legacy browser receives ordinary workflows only. Keep private
entry disabled until the failed clause is requalified.

This runbook stages the order and acceptance. The executor launch definitions,
production browser callbacks and installed native and viewer transports must
be completed and pinned before an operator runs activation or rollback.
