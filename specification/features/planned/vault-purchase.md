---
status: planned
unitIds:
  - adapter.accounts-access-vault-broker-server
  - service.accounts-access-vault-payment
  - validator.accounts-access-vault-payment
---

# Vault purchases

Tracker `25e3ygwc13`. An agent requests a specific purchase. Daniel reviews it in Harness on his iPhone and approves it with Face ID. A private executor runs the checkout and posts a receipt to the original Tracker item.

## Card custody

- Add and remove cards from Vault inside Harness. The iPhone accepts typed entry or an on-device scan. Store reusable card data in device-only Keychain with biometric access control. Keep card metadata and the receipt separate from the encrypted contents. Mac Vault surfaces show the label and last four digits only.
- Card data stays out of general login entries, imports, backups, browser profiles, the web view, analytics and transcripts. Card verification codes are collected in the private flow only if the processor requires them and discarded on every exit. A supported issuer or processor wallet that supplies a payment token can complete a purchase without entering a verification code. Confirm production scope with the payment provider before enrolling real cards. [PCI SSC FAQ 1574](https://www.pcisecuritystandards.org/faqs/1574/)

## Request and approval

- `vault pay` conveys the Tracker item, merchant, item description, currency, amount and card label. Resolve merchant and processor against a reviewed recipe, and derive the checkout identity, amount and currency independently in the private executor. The request refers to the selected card by a device-local identifier and metadata only.
- The approval shows the merchant, total with currency, purchase description, Tracker item, and card label and last four digits. The phone signs the exact request, including the checkout identity, recipe digest, isolated runner fingerprint, card ID and expiry. The approval never asks Daniel to select a machine.
- The initial policy uses integer minor units and exact totals. A changed merchant, processor origin, cart, currency, total or card invalidates the attempt. The offer is valid for at most two minutes and a signed approval for at most one minute within that offer. A kill switch revokes live offers and disables new ones.

## Private checkout and receipt

- Follow the reviewed Vault browser recipe pattern with a disposable profile, signed code, exact egress allowlist, an executor outside the agent's OS trust boundary and an executor-generated key. Keep the browser entirely outside agent reach during checkout and destroy it before returning. The agent sees status and a structured receipt through the broker. Browser screenshots, accessibility, DOM, CDP, recordings and raw errors stay private even after fill.
- Recheck provider-attested merchant, fixed total, currency and checkout immediately before filling and again before submitting. Only use checkout attempts whose processor enforces the approved amount and single-use submission. The sandbox must verify its test mode from processor data. Reject adjustable totals, unresolved deposits, unspecified authorization holds and ambiguous checkout results. A recovery check can query the existing attempt, and never submits a second charge automatically.
- Seal the card data to the isolated runner after Face ID and consume the grant once, before unsealing. If 3-D Secure is required, send the private issuer challenge to Daniel's phone. Tear down after completion, denial, expiry, error or revocation.
- Record one Tracker receipt with the merchant, charged amount and currency, last four, time and verified booking reference. Keep the payment approval audit independent of the merchant's receipt. Allowlist every field written to Tracker.

## Acceptance

- Approval tests prove signature and route binding, expiration, denial, revocation, exact matching, invalidation on checkout change and single consumption. Audit and session-visible responses contain scoped metadata only.
- On `harbor-mbp-2`, run a fixed-price Stripe sandbox Checkout with the public Visa fixture ending in 4242. Verify the successful sandbox payment and its receipt through Stripe. Run a separate sandbox challenge case and exercise the issued challenge on the paired iPhone. While checkout is active, show that agent-side DOM, accessibility, screenshots, CDP and recordings cannot expose the checkout. Inspect the receipt and audit for card-data canaries. [Stripe testing](https://docs.stripe.com/testing)
- Verify enrollment, Face ID, denial, expiry, card removal and the kill switch in the installed Harness iPhone and Mac builds. Install the approved iPhone build with `devicectl` and read back the installed version. Verify the approved broker and app releases separately. Enroll Daniel's card only after those checks.

Live iPhone broker pairing is tracked in `bcx64s`. Installed private checkout isolation depends on the dedicated executor and viewer tracked in `9z0dtp`. The first implementation tests the broker-side offer and exact checkout approval with a synthetic phone. The protected browser boundary, processor readback, native UI and live broker routing still require integration proof.
