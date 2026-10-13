# Feature: Pinned Rust Toolchain

## Overview

The ordinary Rust entry points use the nearest `rust-toolchain.toml` pin. They parse its TOML and ask `rustup which --toolchain <pin>` for each tool. Child processes receive the matching compiler, toolchain and executable directory. Host settings remain unchanged.

## Acceptance Criteria

- `bun run check:kernel`, `bun run build:kernel` and the `cargo` and `rustc` tool versions of `harness.verify.json` run through `scripts/rust.ts` or its helper `src/utils/pinnedToolchain.ts`.
- With an older standalone cargo first on `PATH` and no rustup shims, the check passes, the build records the pinned compiler in `target/kernel/build.json`, and the recorded tool versions are those of the pin.
- Host `RUSTUP_TOOLCHAIN`, `RUSTC` and compiler-wrapper overrides cannot replace the pinned tools. Invalid nearest pins fail without searching for a different pin.
- Without rustup, or with a pin that is not installed and may not be installed, each ends with a failure that says what is missing.
- Rust and reference sources, benchmark workloads and methods, test assertions and the artifacts of the build are unchanged.
- Proof: all eight cases in `test/utils/pinned-toolchain.test.ts`, including explicit overrides, plus the normal kernel check with invalid host toolchain, compiler and wrapper settings.

## Known Limits

- The pin must already be installed. The helper neither installs a toolchain nor falls back to a standalone cargo.
- A machine with a suitable cargo but without rustup now fails instead of building with that cargo.
- The audit of other projects still runs their own `cargo fmt` and `cargo clippy` as found on `PATH`; that is their toolchain, not this repository's.

## Host Files

Agent host-file changes, tracked as metadata only:

- Claude project memory `~/.claude/projects/-Users-danielfugere-projects-harness/memory/harness-shared-checkout-gotchas.md`: owner `7f0b5b97-5297-4f84-88b7-4cd142055979` added one note. Before SHA256 `4fb14ee826d6806a9d1afcaf40026163fe745aca1e34cf69a3335163f08d63c0`; after SHA256 `86f7c9e20f1f5cde233ca07a1aad038301ad80b217e8ae46626ac561d0d0434f`, 8844 bytes. Contents remain private.
- Task-owned scratch outside the repository: `/tmp/harness-pinned-rust-*`. No toolchain was installed and no shell or PATH setting was changed.
