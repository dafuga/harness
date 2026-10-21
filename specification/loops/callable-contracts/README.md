# Callable parameters and returns

Each function contract now shows its actual signature, parameters and returned value.
For example, `toKebabCase(value: string): string` has a `value` parameter and returns a
`string`. A module containing several functions presents separate callable sections,
so their parameters and return values cannot be mixed together. Return tables omit
the redundant Name column. The existing trailing info controls and example modal are
shared with ordinary component, page and config contracts.

The four casing functions declare concrete input/output examples in their existing
unit document. These are authored examples, checked against the implementations;
they are not presented as recorded test observations. Zero-argument functions state
that they have no parameters, and a void return stays void.

Opus 5.5 implemented the frontend in an isolated worktree, editing only EntityContract
and the generated ContractTable component. Codex integrated the source-derived data,
registered the reusable table, checked its consumers and exercised both callable and
ordinary component example modals. The generated placeholder test was omitted;
existing standardized contract tests own this behavior.

## Proof

- Failing-test commit: `aa89d87a`.
- Fix commit: `13247fdea9a174c8f43fa3594241eb207829eb37`.
- Failing checkpoint: `1dc08aaf3a2d8b9b719f6189e6633a1bcc262b510c974eb52eca5354fd5202ab`.
- Passing checkpoint: `4d10112111f3391830bcca4bf38e75771373ada26365b348ca0dccc595fb6791`.

The same frozen tests and command fail before the repair and pass after it. Three
browser cases exercise current and historical contracts at desktop, tablet and phone
sizes. Fixtures include repeated parameter names, differing return types and a
zero-argument/void function. In a separate isolated fix snapshot, restoring only the
old renderer makes the contract guard fail; putting the repair back passes it.
Screenshots and logs stay outside Git in `/tmp/harness-callable-contract*`.

The Reports package check passes formatting, types, lint, all 599 unit tests, builds
and audit. The 13 root casing/ownership tests pass. Registry validation reports 1308
units, 64 existing uncertainties and no errors. Root formatting, types, lint and Rust
checks pass; the full root suite was interrupted during unit tests to keep its later
Electron testing excluded. No native-device or production deployment was performed.

## Process prevention retro

The combined module contract predated the previous fix. Codex commit `3cf009b8`
introduced owner-qualified display labels and tests that asserted those invented
labels, rather than correcting the API grouping. The earliest missing control was
acceptance-test design: a page fixture with arbitrary field labels did not establish
what a real callable accepts and returns.

The primary repair to normal verification is the reusable API-contract assertion in
the existing entity preview flow. Callable metadata now drives its fixtures, and the
assertion checks literal parameter identifiers, return association and empty/void
APIs at both revision scopes. Reintroducing the old renderer proves it rejects the
original failure. Keep this semantic check in the contract test ownership boundary;
a label-only assertion cannot replace it. This adds no new CI job or workflow.
