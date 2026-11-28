---
status: planned
shippedIn: null
unitIds:
  - function.accounts-access-vault-recipe
  - function.accounts-access-vault-method
  - function.accounts-access-vault-cdp-handoff
  - function.accounts-access-vault-lease
  - function.accounts-access-vault-executor-host
  - function.accounts-access-vault-egress-rules
  - function.accounts-access-vault-otp-route
  - function.accounts-access-vault-teardown
  - function.accounts-access-vault-security-audit
  - function.accounts-access-vault-phone-view
  - adapter.accounts-access-vault-seal
  - repository.accounts-access-vault-device
  - repository.accounts-access-vault-audit
  - service.accounts-access-vault-broker
  - service.accounts-access-vault-lease-keeper
  - adapter.accounts-access-vault-broker-server
  - adapter.accounts-access-vault-broker-client
  - adapter.accounts-access-vault-browser-docker
  - adapter.accounts-access-vault-cdp-relay
  - adapter.accounts-access-vault-peer
  - service.accounts-access-vault-browser-recipe
  - service.accounts-access-vault-teardown
  - validator.accounts-access-vault-wire
  - command.accounts-access-credential
owner: null
reviewedAt: null
---

# Credential Vault in Harness

Proposed on Tracker item `xrmz3f`, revised for implementation on `tzqm5r` with the Chief of Staff review of 22 November. Harness iOS becomes the request and approval surface. A login first uses a provider API token or OAuth device grant. A browser login runs only when the reviewed recipe allows no API or device method for the action. That login uses a reviewed, signed script in one fresh headed Chromium container. After verification, the requesting session gets a real CDP endpoint to that browser and can drive it with Playwright. Only that session can reach the endpoint, and no TCP port is opened. Passwords, OTPs and provider tokens never reach the session. Phase 1 code is pure policy and is exercised with synthetic data only. Real site logins and real secrets wait for Daniel's approval on his phone. The `m8fkcj` cutover proceeds independently.

**Daniel's decision (22 November, 13:45, option B).** After the scripted login the session gets full CDP/Playwright control of the logged-in browser. It does not get a mediated gateway with an operation list, read-only default or URL deny list. Because the session can read cookies and open any page, three controls carry more weight: the endpoint is reachable only by the requesting session, the container's network allowlist applies, and destroy signs out on the provider and checks the security log.

## Interim: Harness iOS approves for the live broker

Daniel, 26 November: vault requests belong in the Harness app now (Tracker `bcx64s`). Until the Harness broker takes over, Harness iOS is a second approver of the live credential broker and speaks `CB-DEVICE-V1` to it unchanged. The native code is under `packages/desktop/ios/App/App/Vault/`; the web view only opens it. It needs iOS 17.

- **Pairing and custody.** The app is enrolled with the broker's QR pairing, with its own Secure Enclave keys, so the old app's enrollment is untouched. Saved logins move by the old app's encrypted backup, never as plaintext. The Phase 4 rule that Harness pairs through Google device linking applies when the Harness broker takes over.
- **Picking a login.** Every saved login for the requested service or site is offered. The username and website are readable before Face ID so they can be listed, and must match the sealed entry when it is opened.
- **Release modes.** An approval-only request releases nothing. A deferred sign-in (`deferredOtp`) releases only the password; the later `codeOnly` request releases only a fresh code. A `websiteDomain` request releases only to a login saved for that exact website. A request with a `selectionId` is approved for that offer and broker origin.
- **Not covered yet.** Remote push needs an APNs build (`VAULT_APNS`) and broker push settings; without it the app polls while it is open.

## Method selection rule

For each requested `(site, action)` the recipe declares its methods. Harness picks the first eligible method in this fixed order:

1. `api-token`: a scoped provider credential delivered to a reviewed script, for example a Stripe restricted key or a Cloudflare project token.
2. `oauth-device`: an OAuth device authorization grant, or another officially supported device flow, approved on the phone.
3. `browser`: a scripted headed login.

This is a selection rule, not a fallback chain. If the recipe declares an `api-token` or `oauth-device` method for the action, the request uses it. If that method is not ready, for example because no token is enrolled, the request is **blocked** with that reason. It does not fall through to a browser. A browser login is selected only when no API or device method covers the action. The recipe must record a reviewed reason, such as `the provider has no API for this console page`. `vaultMethod` implements this rule.

## What moves from the credential broker into Harness

The private `dafuga/credential-broker` repository (main `b2d83b2`) and `credential-broker-ios` remain the authority until each step of the migration below passes acceptance.

| Broker source                                         | Destination in Harness                                                                                                                                                                                                                         | Phase |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `PROTOCOL.md` CB-DEVICE-V1 signing input, envelopes   | Kept byte-compatible. Harness adds `CB-DEVICE-V2` fields for recipe digest, runner fingerprint, method, lease scope.                                                                                                                           | 2     |
| `src/crypto.ts` X25519/HKDF/ChaCha20-Poly1305 sealing | `src/adapters/accounts-access/VaultSealAdapter.ts`, unchanged algorithms and test vectors.                                                                                                                                                     | 2     |
| `src/device.ts`, `config.ts` device pins and roles    | `src/repositories/accounts-access/VaultDeviceRepository.ts`; Harness iOS pins enrolled through Harness Remote pairing.                                                                                                                         | 2     |
| `src/broker.ts`, `server.ts` request queue, approval  | `src/services/accounts-access/VaultBrokerService.ts` behind `harness credential`; Unix socket peer checks from `peer.ts`/`peercred.c`.                                                                                                         | 2     |
| `src/audit.ts` journal and Tracker mirror             | `src/repositories/accounts-access/VaultAuditRepository.ts`, still blind to secret values; receipts noted on the Tracker item.                                                                                                                  | 2     |
| `pairing.ts`, `pair-*.ts` QR pairing                  | Replaced by Harness Remote pairing in `packages/relay` and `packages/remote`. There is no QR pairing; devices link through Google sign-in (`google-device-linking.md`).                                                                        | 3     |
| `workflows/*.mjs`, `scripts/codex-npm-login.sh`       | Rewritten as signed recipes under `deploy/vault/recipes/<site>.json` with their scripts; old workflows become parity fixtures (`yedhbr`).                                                                                                      | 3     |
| `workflows/wrangler.mjs`, `docs/wrangler.md`          | `api-token` method of the Cloudflare recipe, shared with `harness deploy` broker access (`56x4kx`, `8wwrzr`).                                                                                                                                  | 3     |
| `selectionId` environment offers                      | Offers kept, picker removed (Daniel 25 Nov). Each eligible host arms an offer and Harness picks one: the user's own device first, a sealed container only as fallback. The phone asks no location question; approval stays bound to that host. | 2     |
| `credential-broker-ios` vault, Face ID, APNs          | Harness iOS `Vault` feature beside `Account/HubAccountVault.swift`, using fresh device-bound keys and a sealed transfer of entries.                                                                                                            | 4     |

These items stay outside Harness: the Google account, banking and money, and the vault master password (Daniel 18 Nov), and npm publishing through trusted publishing.

## Components and contract

- **Harness client.** `harness credential request <site> <action> --item <id> [--account <alias>] [--json]` binds the request to the authenticated session, Tracker item, project, environment, account alias, recipe digest and action. `harness credential status <request>` returns the phase and receipt IDs. `harness credential attach <lease>` and `harness credential finish <lease>` control a handoff. Codex, Claude and Grok use the same protocol and tool surface.
- **Broker and policy.** Reuse the broker's pinned routes, device enrollment, phone-signed approval, ephemeral X25519 delivery and audit. The signed approval payload adds `recipe` (site, revision, digest), `method`, `runner` (host, fingerprint), `origins`, `action`, `mode` (`read` or `write`), `account`, `session`, `nonce` and `expiresAt`. A request has one consumer. Replay, a revoked device, a failed preflight or a changed scope is rejected.
- **Browser executor host.** `vaultExecutorHost` admits a host only if the executor runs as a separate OS user or inside a VM. The agent's OS user must not be root and must not belong to `docker`, `admin`, `wheel` or `sudo`. It also must not have sudo, Docker socket access or write access to the executor's home. Without a passed Chromium sandbox preflight the host is ineligible. Grok's box gives every bot passwordless sudo, so automated logins never run there unless the executor is inside a VM on a hypervisor where box users have no sudo, Docker or VM-control access. The primary Mac and MB2 qualify with a dedicated `harness-vault` user that owns the Docker context and has no login shell.
- **Container.** Reuse the `zfep7c` lifecycle (`ManagedProviderDockerAdapter`, task-owned volumes, crash recovery) with a separate pinned image: headed Chromium, Xvfb and the pipe bridge. The container runs nonroot with a read-only image, a task-only writable profile and scratch, no host home, no Docker socket and no agent process. Chromium starts with `--remote-debugging-pipe` and never `--remote-debugging-port` (`vaultChromiumArgs`). An in-container pipe bridge relays CDP frames over `docker exec -i` stdio to the host relay. No socket crosses the Docker Desktop VM boundary. The image refuses to start if any TCP listener other than the loopback egress proxy is present.
- **Network allowlist inside the container.** `vaultEgressRules` renders an nftables ruleset that the container entrypoint loads into its own network namespace before Chromium starts, as root with `CAP_NET_ADMIN` dropped afterwards. Only the proxy user may open outbound TCP 443, and only DNS to the configured resolver is allowed. Chromium's user reaches only the loopback proxy, which admits `CONNECT` to the recipe's exact hosts. A host-level Docker network policy is defence in depth, not the enforcement point.
- **Site recipe.** `deploy/vault/recipes/<site>.json`, validated by `vaultRecipe`. It declares site, revision, account alias and identity check, exact origins and permitted redirects, methods, actions with their read or write intent and the page the handoff opens on, OTP channels, ordered login states, teardown and timeouts. A changed origin, an unfamiliar consent screen or an unexpected account causes a structured stop.
- **Recipe signing and review.** A recipe is usable only with a review envelope `deploy/vault/recipes/<site>.review.json`: `{ site, revision, digest, reviewer, reviewedAt, signature }`. The digest is SHA-256 of the canonical recipe JSON. The signature is Ed25519 over the canonical `{kind:"vault-recipe-review", site, revision, digest, reviewedAt}`, made by a reviewer key on the trust list. Daniel's key is the only reviewer key in phase 1. A review older than 90 days or for another digest is rejected. Harness iOS shows the first 16 hex digits of the digest, grouped in fours, plus site, revision and review date on the approval screen before Face ID. The executor checks the same digest before it consumes the sealed credential.

## TTLs

| Stage                  | Limit                                                                             | Source                          |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| Request offer          | 120 s from creation                                                               | Broker v1 parity                |
| Sealed delivery        | Earlier of request expiry and 60 s after approval, consumed once                  | Broker v1 parity                |
| TOTP                   | Generated on the phone at approval, current 30 s step only                        | `vaultOtpRoute`                 |
| SMS or email code      | Entered on the phone within 300 s of the challenge, single use, 3 attempts        | `vaultOtpRoute`                 |
| Scripted login         | 180 s from sealed delivery to identity verified, otherwise stop and destroy       | Recipe `timeouts.loginMs`       |
| Handoff claim          | 60 s after the lease is issued; the one-time token is consumed by the first claim | `vaultLease`, `vaultCdpHandoff` |
| Lease                  | Default 15 min, recipe maximum up to 60 min, idle timeout 5 min                   | `vaultLease`                    |
| Same-session reconnect | Within 30 s of a disconnect, at most 3 times per lease                            | `vaultLease`                    |
| Daniel private view    | 10 min, only while the request is pending                                         | `vaultPhoneView`                |
| Teardown               | 120 s for logout, revoke and container removal                                    | `vaultTeardown`                 |
| Security log checks    | At lease end and again 15 min later                                               | `vaultSecurityAudit`            |
| Recipe review          | 90 days, or until the digest changes                                              | `vaultRecipe`                   |

## Request, approval and login

1. **Request and preflight.** Verify session identity and intent, recipe review and digest, method selection, executor host eligibility, provider route, network readiness and device enrollment. For a browser method, start one isolated runner and bind its ephemeral recipient key and fingerprint to the request. A failed preflight never prompts for a secret.
2. **Review in Harness iOS.** The owner opens the Vault inbox or a push deep link that carries only the request ID. Show requester, host, project and environment, account alias, site and action, method, read or write mode, the recipe digest group, runner fingerprint and expiry. Daniel picks the matching entry and approves or denies with Face ID. A change of scope, runner, account, recipe digest or destination needs a fresh approval.
3. **Sealed delivery.** Harness iOS signs the approved envelope and seals the credential to the verified runner key. Only the registered recipe consumes it, once, in a bounded process. Authentication-page traces, screenshots, console captures and secret-bearing Chrome arguments stay off.
4. **OTP.** `vaultOtpRoute` chooses the challenge path from the recipe's channels:
   - `totp`: the phone computes the code from the approved entry and seals it with the password.
   - `sms`: the provider texts Daniel's phone. Harness iOS shows a one-time-code field with iOS SMS autofill and seals the entered code to the runner. SMS is never forwarded through Twilio, the relay or the box.
   - `email`: Daniel reads the code in his mail app and enters it in Harness iOS, which seals it. A magic link is pasted into the same field and opened only inside the runner. Harness never reads the mailbox in phase 1.
   - `push` or `passkey`: Daniel confirms on the trusted device. Nothing is sealed.
     A later challenge during the same login opens a new scoped prompt on the phone with its own 300 s limit.
5. **Execute and verify.** Run the site script without model involvement. Confirm the provider identity, tenant, logged-in destination and requested capability before handoff. Close the login tab and clear its history before handoff. Then stop the login process and discard its payload. A wrong account, timeout, lockout or unrecognised page returns a redacted stage and goes to teardown.
6. **Operate, then destroy.** Issue one lease to the original session and record owner, recipe digest, mode, times, verdict and receipt references on the Tracker item. End the lease on finish, expiry, idle, revocation or host shutdown, then run `vaultTeardown`:
   1. Close the CDP socket and drop the session's connections.
   2. Sign out on the provider side with the recipe's logout path, then call the recipe's session revoke API when it declares one.
   3. Close Chromium, remove the labelled container, profile and scratch, and verify the removal.
   4. Read the account security log through the recipe's `securityLog` source and run `vaultSecurityAudit` over the lease window. Repeat 15 min later. A new API token, OAuth grant, recovery email or phone change, 2FA change, password change or an unattributed new session raises an alert. The alert goes to the Tracker item and Harness iOS. If the log cannot be read, the verdict is `unverifiable`, which also flags Daniel.
      Recover after a crash from the broker receipt and run-owned labels. Retry an uncertain cleanup only for those resources and keep the attachment unavailable meanwhile.

## Session CDP handoff

The session gets the raw Chrome DevTools Protocol for the logged-in browser and can drive it with Playwright, Puppeteer or plain CDP. It can navigate, run scripts, read the DOM, cookies and storage, and download, within the container's network allowlist and the lease lifetime. Daniel decided this on 22 November (option B).

- **No TCP port.** Chromium speaks CDP only over `--remote-debugging-pipe`. The host relay runs as the executor user and serves CDP as a WebSocket on a Unix socket, `/run/harness-vault/<lease>/cdp.sock` (macOS: under the executor's private run directory). The lease directory is mode `0700`, and an ACL grants the requesting session's OS user access to the socket.
- **Only the requesting session.** `vaultCdpHandoff` accepts a connection only when the kernel-reported peer UID (`SO_PEERCRED` on Linux, `getpeereid` on macOS, as in the broker's `peercred.c`) is the session's user and the HTTP upgrade carries the lease's one-time token. The token is given to the session by `harness credential attach` and stored only as a SHA-256 digest. The endpoint also requires an attached, unexpired lease, which `vaultLease` decides.
- **Endpoint.** `harness credential attach <lease> --json` prints `{ "endpoint": "ws+unix:///run/harness-vault/<lease>/cdp.sock:/devtools/browser", "headers": { "Authorization": "Bearer <token>" }, "expiresAt": … }`. The session calls `chromium.connectOverCDP(endpoint, { headers })`. A local probe on 22 November with Playwright 1.63 connected this way to a headed-capable Chromium on `--remote-debugging-pipe` and drove a synthetic page, with no TCP listener.
- **Same session, bounded.** A dropped connection can reconnect within 30 s, at most 3 times. A different session, user or host needs a new request and approval.
- **What the session still never gets.** The password, OTP and provider API tokens are consumed by the login script before handoff, and the login tab is closed. The session never gets the browser profile directory, the container shell or the Docker socket. Cookies it reads stay its responsibility. The post-lease security check and provider sign-out are the controls after the lease.

## Daniel's private view and control

During the pending phase, after a CAPTCHA, device challenge or unknown page, Daniel can take over the same guest from his phone for up to 10 min. `vaultPhoneView` selects the transport in this order:

1. **Harness Remote relay** (`packages/relay`, `packages/remote`): the paired Harness iOS device opens an end-to-end encrypted channel to the executor host. The host relay streams CDP screencast frames to the phone and forwards Daniel's touch and key input, with Daniel recorded as the actor.
2. **Phone fallback, Cloudflare Tunnel and Access**: if the relay is unreachable, the same encrypted frames go over the executor host's Access-protected origin, like the current `cb-mac` route. Each view uses a one-time view token bound to the device key and request.
3. Otherwise there is **no view**. The request stays blocked with the stage shown in Harness iOS.

The view never exposes CDP, cookies or the profile. The session gets access only after the script rechecks identity and capability. If the provider requires the trusted phone itself, use its official continuation, passkey, OAuth or device flow. Never move phone cookies, weaken site controls or change the client fingerprint to get past a refusal.

## Code layout

Phase 1 is in this change. All modules are pure and use synthetic data in their tests.

| Unit                                            | Source                                            | Responsibility                                            |
| ----------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `function.accounts-access-vault-recipe`         | `src/utils/accounts-access/vaultRecipe.ts`        | Recipe schema, canonical digest, review signature check   |
| `function.accounts-access-vault-method`         | `src/utils/accounts-access/vaultMethod.ts`        | API token, then device grant, then browser selection rule |
| `function.accounts-access-vault-cdp-handoff`    | `src/utils/accounts-access/vaultCdpHandoff.ts`    | Pipe-only launch, Unix socket endpoint, session-only peer |
| `function.accounts-access-vault-lease`          | `src/utils/accounts-access/vaultLease.ts`         | Lease state machine and TTLs                              |
| `function.accounts-access-vault-executor-host`  | `src/utils/accounts-access/vaultExecutorHost.ts`  | Separate-user or VM executor eligibility                  |
| `function.accounts-access-vault-egress-rules`   | `src/utils/accounts-access/vaultEgressRules.ts`   | In-container nftables and proxy allowlist                 |
| `function.accounts-access-vault-otp-route`      | `src/utils/accounts-access/vaultOtpRoute.ts`      | TOTP, SMS, email and push challenge routing               |
| `function.accounts-access-vault-teardown`       | `src/utils/accounts-access/vaultTeardown.ts`      | Logout, revoke, removal and audit schedule                |
| `function.accounts-access-vault-security-audit` | `src/utils/accounts-access/vaultSecurityAudit.ts` | Post-lease security log verdict                           |
| `function.accounts-access-vault-phone-view`     | `src/utils/accounts-access/vaultPhoneView.ts`     | Relay, then Access tunnel, then no view                   |

Later phases, each its own reviewed PR with tests:

- **Phase 2, broker in Harness (synthetic vault only), built on `b9e3w0`.**

  | Unit                                          | Source                                                         | Responsibility                                                              |
  | --------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
  | `adapter.accounts-access-vault-seal`          | `src/adapters/accounts-access/VaultSealAdapter.ts`             | Broker v1 sealing and P-256 proofs, plus `CB-DEVICE-V2` approval input      |
  | `repository.accounts-access-vault-device`     | `src/repositories/accounts-access/VaultDeviceRepository.ts`    | Enrolled phones, roles and single-use 30 s challenges                       |
  | `repository.accounts-access-vault-audit`      | `src/repositories/accounts-access/VaultAuditRepository.ts`     | Owner-only append-only journal with allowlisted, secret-free fields         |
  | `service.accounts-access-vault-broker`        | `src/services/accounts-access/VaultBrokerService.ts`           | Request queue, V2 approval and scope checks, single delivery                |
  | `service.accounts-access-vault-lease-keeper`  | `src/services/accounts-access/VaultLeaseKeeperService.ts`      | Lease issue, one-time CDP token attach, relay admission, teardown plans     |
  | `adapter.accounts-access-vault-broker-server` | `src/adapters/accounts-access/VaultBrokerServerAdapter.ts`     | JSON over an owner-only Unix socket with an injected peer-UID check         |
  | `adapter.accounts-access-vault-broker-client` | `src/adapters/accounts-access/VaultBrokerClientAdapter.ts`     | Unix socket client                                                          |
  | `validator.accounts-access-vault-wire`        | `src/validators/accounts-access/VaultWireValidator.ts`         | Wire schemas; refusals name the field, never its value                      |
  | `command.accounts-access-credential`          | `src/commands/accounts-access/CredentialCommand.ts`, workflows | `harness credential serve\|request\|status\|cancel\|attach\|finish\|recipe` |

  `CB-DEVICE-V2` signs the V1 lines with `CB-DEVICE-V2` as the first line, followed by the recipe digest, runner fingerprint, method and `<mode>:<leaseMs>`. An approval restates method, mode, account, session, action, host and lease length, and any difference is refused, so a changed scope needs a fresh approval. Only an `oauth-device` approval carries no sealed credential. A CDP lease is issued only when the broker knows the session's kernel-verified OS user. On macOS the phase 2 socket relies on its owner-only directory and reports no peer, so leases there wait for the phase 3 `getpeereid` check. Tests use a fake phone signer, a fake runner, synthetic canaries and the broker's v1 crypto vector.

- **Phase 3, executor and CDP relay (synthetic site).** The fixture uses `deploy/vault/Dockerfile`, `VaultBrowserDockerAdapter`, the in-container pipe bridge, and `VaultCdpRelayAdapter`. It accepts synthetic `.test` origins on an internal-only Docker network. `VaultPeerAdapter` reads the kernel UID for the broker and relay under Node. The synthetic reviewer signs the recipe, which binds the script bytes, and the fake phone separately seals the password and SMS or email code. The fixture verifies the account and action, closes the login tab, and hands the requesting session the authenticated roster tab. The E2E checks sandboxing, browser history, egress, provider logout, both security-log checks (with a controlled clock), removal, and crash recovery. Cross-user isolation on the dedicated MB2 executor remains a separate acceptance gate. Follow the [browser fixture and account runbook](../../../deploy/vault/README.md) for provisioning and verification.
- **Phase 4, Harness iOS Vault.** Vault inbox, recipe digest display, the read or write action and lease length, OTP entry with SMS autofill, sealed delivery and the private view, tested on a physical enrolled iPhone. The authenticated device queue supplies the runner's ephemeral public key. The native client checks it against the displayed runner fingerprint before sealing and restates the reviewed scope in its signed decision. The interoperability fixture exchanges only synthetic entries and exercises the same broker verification and decryption as a phone.
- **Phase 5, real sites.** These need Daniel's approval on his phone first, one site at a time, in the order of the migration plan.

## Site recipes and acceptance

| Site       | Selected method for the first actions                                                           | Browser recipe proof when browser is selected                                                             |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Google     | `oauth-device` for eligible API scopes. The Google account itself stays manual (Daniel 18 Nov). | None in this plan.                                                                                        |
| Stripe     | `api-token`: a restricted key for the approved account and mode.                                | Read-only Dashboard on an approved test account with secondary authentication, test/live context checked. |
| npm        | Trusted publishing for releases. `browser` for the organization roster, which has no API.       | Approved account and organization, current MFA (TOTP or email), read-only roster check.                   |
| Cloudflare | `api-token` through Wrangler with a project-scoped token (`8wwrzr`, `56x4kx` gates).            | Account and project identity, approved SSO or OTP, read-only inspection.                                  |
| OpenAI     | `api-token`: project-scoped API access for a named operation.                                   | Platform organization and project, the exact SSO route and MFA.                                           |
| Twilio     | `api-token`: a scoped API key for the approved operation.                                       | Exact account or subaccount, SMS or TOTP MFA, a nonmutating console operation.                            |

Before certifying a site, run deterministic success and failure fixtures for redirects, identity checks, expired and repeated approvals, each OTP channel, outages, lease enforcement, endpoint reachability from other users and sessions, secret non-disclosure and teardown with the security log check. Then run one authorized, bounded live sign-in and read-only follow-up per site and account mode. One site's success gives no acceptance for another. Record the exact runner and recipe digests, denial reasons and completed cleanup. Use synthetic canaries to show that the password, OTP and provider tokens never reach the session, and that no secret reaches Tracker, logs, receipts or evidence. Include disconnect and crash, timeout, concurrent attach and host restart cases. For iOS, cover enrollment and recovery, Face ID deny and retry, deep-link and approval replay, digest mismatch, expiration, operation after switching apps, and an end-to-end approval on a physical enrolled iPhone.

## Migration of the existing Vault work

| Tracker item | Preserve and migrate                                                                                                | Acceptance before superseding                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `8ks121`     | Existing broker policy, scoped token and short-lived approval/receipt workflow. Keep npm's trusted-publishing lane. | Project/env role and credential scope, expiry, replay denial and Tracker receipt parity.                                                   |
| `e5ccnb`     | Native iOS custody, Face ID, device-bound signing and sealed password/OTP delivery into Harness iOS.                | Approve/deny and recovery on physical iPhone. Enroll new app keys with verified pins and confirm vault receipt before switching authority. |
| `bby1na`     | Paired CLI add/import, hidden entry and sealed transfer from computer to phone. Preserve website-domain metadata.   | Confirm actual save and reopen on each Mac with a synthetic entry. Cover malformed domain, expiry and wrong recipient.                     |
| `5vj3yf`     | The primary-Mac synthetic add diagnostic and receipt workflow.                                                      | Prove the CLI receives a final stored result and iOS reopens it. Broker polling and a running CLI are insufficient.                        |
| `rma976`     | Google sign-in device linking and match code; retain instructions for macOS/Linux and per-host public pins.         | Check sign-in publication of the public key, approval expiry, mismatch denial, re-enrollment and recovery. No secrets in logs.             |
| `yedhbr`     | Existing primary-Mac Codex login recipes and scope checks as parity fixtures.                                       | Fresh headed guest login and authorized Codex handoff after script exit; preserve the approved fallback during transition.                 |
| `rw3ngx`     | Claude MCP/browser adapter direction via the same broker contract.                                                  | Claude requests, attaches over CDP, performs the operation and finishes without seeing the password, OTP or provider token.                |
| `1je8hw`     | Grok/box relay and signed approval parity over the same broker contract.                                            | Approval relay parity only. Automated logins stay off the box unless the executor is in a VM that box users cannot control.                |
| `8wwrzr`     | Cloudflare/Wrangler sealed scripted token or approved authentication flow with project boundaries.                  | Prove scoped delivery into the approved script, useful redacted receipt, cleanup and compatibility with deployment gates.                  |

1. Inventory pinned broker/app revisions, site recipes, enrolled public identities and existing item/receipt IDs using metadata only. Preserve encrypted recovery and documented rollback. The existing Vault stays the authority while Harness runs synthetic shadow checks.
2. Pair Harness iOS using fresh device-bound keys and verify public pins. Transfer approved entries only by a user-authorized sealed device flow or explicit re-entry. The native single-entry decoder preserves the standalone broker's `CB-VAULT-ADD-V1` format, including the recipient, domain, expiry and separate preview and login envelopes. Validate counts, entry domains, destinations and save/reopen without exposing vault content or exporting signing keys.
3. Prove one disposable browser recipe and CDP attach on MB2 as the `harness-vault` user, using synthetic data. Start the real-site pilot with npm's read-only roster, then Twilio and OpenAI, then Google, Cloudflare and Stripe, using API or device methods wherever the selection rule picks them. Compare start time, CPU/RAM and per-run disk against the `zfep7c` baseline.
4. Move one host, site and client path at a time after approval and verification. Keep one approval authority per request. Roll back by routing new requests to the retained legacy release and phone app, revoking candidate leases and keeping audited history.
5. Link all nine items to their verified Harness replacements and supersede each after its replacement is merged, accepted and operational. The existing vault and `m8fkcj` remain operable throughout.
