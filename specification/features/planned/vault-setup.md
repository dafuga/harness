# Vault setup on this computer

Harness owns the local executor lifecycle. The CLI exposes `harness vault setup`,
`harness vault remove`, and an unelevated `harness vault status`. The standard Harness
and Harbor Mac apps run the same installer with a system administrator prompt.

Setup creates or repairs a dedicated, non-admin local identity, owner-only data
directory, and private Docker engine. The engine uses an isolated Colima profile
on macOS and rootless Docker in a dedicated Linux environment. Existing host
eligibility and browser qualification are still required before provider use.

Progress and the exact failing operation are visible during both setup and
removal. The root-owned journal binds account ownership before mutations and
supports retry after interruption. Removal stops Vault's engine, preserves
private data under the root-owned archive, and deletes only journaled identities.

Proof covers macOS sudo denial output, both Directory Services attribute formats,
the Darwin socket test path, interrupted provision and removal, ownership conflicts,
and the Settings states in both apps. Use synthetic data and disposable identities.
