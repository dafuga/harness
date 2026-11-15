# Component screenshot coverage

Start with `harness units guide <id>`. Write and commit the standard test for NEXT,
run `harness verify run --priority agent-test --entity <id>`, then rerun the guide
until DONE. Run `harness units check-contract <id>` when writing/changing a
contract. REQUIRED states come from the repo; GUESSES identify boundaries to review.

Every active target in /tmp/codex-sol/sol6-targets.md needs a reviewed prop/default/error contract and committed catalog states for its actual distinct presentations. Native forwarding atoms use native context and a small caller-content/control-state matrix. Desktop and explorer fixtures cover empty, loading, error, disabled and open/closed branches where present.

Write and commit the standard catalog Playwright tests, then run `harness verify run --priority agent-test --entity <id>`. Complete passing entity checks automatically attach every declared state and desktop/tablet/mobile screenshot with the sealed record link; failed or incomplete runs attach nothing. Fetch every state/device through the screenshot API at its tested commit. Keep scoped proof separate from whole-commit verification. Follow the active task's host and worker limits, retain the memory guard, and leave the dedicated preview running. Do not restore retired report UI or exports.

The two stale test mappings are fixture defects, not product red-green proof: the console state inventory and framework-page resolver still name Shells instead of the declared Layouts states/pages; the picker guard reads pre-relocation source paths. Correct the existing standardized fixtures and rerun them without weakening assertions.
