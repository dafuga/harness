# Distinguishable contract field names

A multi-function contract retained qualified source names such as `toKebabCase.value`,
but its shared table removed their owners and displayed four identical `Value` rows.
The renderer now retains readable owners when sibling names collide. Types, examples,
info buttons and modal contents still belong to the original field.

The existing typed-contract rendering and browser tests previously covered distinct
field names only. Their shared declared fixture now includes four functions with a
`value` input. The unchanged browser flow checks their labels and opens their example
modals at desktop, tablet and mobile sizes, both at the tip and a historical revision.

- Failing-test commit: `34d4a89c1789a2f3289a57a78a139409abe35589`.
- Fix commit: `3cf009b80a5555b6c759596b08fc8dcf07652166`.
- Paired failing checkpoint: `700d45499b7becb0398ec55caf38923b2a4b06a1cf0a548a33bc54eccc4145dc`.
- Paired passing checkpoint: `cf295f1581aec716a74ee90389989a90be3da62058f2811cc71af3aaf4a401bf`.

Both committed revisions ran through the same recorder process after an earlier
separate-process run encountered environment-fingerprint drift. The tests, fixtures,
command and assertions stayed unchanged. Test-owned before/after images remain in
`/tmp/harness-contract-field-names/`; generated screenshots are not committed.

Verification: the Reports package check passes formatting, types, lint, all 598 unit
tests, builds and audit. The three focused browser tests pass; the live Code name
casing contract and camel-case example modal were manually exercised without browser
errors. The root ownership guard also passes all 11 tests. Root formatting, types,
lint and Rust checks passed, but the full root pipeline was interrupted during its
unit suite; its later Electron testing remains excluded at Daniel's request. No
Electron app testing, native-device deployment or production deployment was performed.
