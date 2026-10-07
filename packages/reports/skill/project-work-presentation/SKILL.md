---
name: project-work-presentation
description: Present implementation work and requested full test suites in the local Project Reports hub, with live checks, screenshots, findings, and portable exports. Use for project changes and verification runs, not for planning-only or simple read-only questions.
---

# Project work presentation

Use the Project Reports workspace at `/Users/danielfugere/projects/harness/packages/reports`. Its CLI is `harness report` or `bun /Users/danielfugere/projects/harness/src/index.ts report`. Reports and copied evidence live under `~/.codex/project-reports`, outside application worktrees.

Begin a new **feature** report when implementation starts, or a **suite** report when Daniel requests a full test run. Record the project path, task, actual environment, and tested revision when known. A feature report covers affected flows, before/after evidence, acceptance criteria, regression results, and relevant downstream screens. Do not expand it into an unrelated full-site run. A full-suite report inventories workflows and checks desktop at 1440px, tablet at 920px, and mobile at 390px, with native device evidence when applicable. Mark untested, skipped, failed, and blocked cases explicitly.

Use `begin`, `record`, `import`, `finalize`, and `serve` as documented in the [CLI guide](/Users/danielfugere/projects/harness/packages/reports/README.md). Add checks and screenshots as they arrive so the live report reflects progress. Existing project test commands remain authoritative. Use the Playwright, Vitest, command outcome, and manual evidence imports where useful. A check is passed only if the observed result proves it; mark stale or unavailable evidence `not-proven` or `blocked`. For backend work, use API and test evidence when screenshots do not apply.

Before recording screenshots, use the `screenshot-readiness` gate: wait for final fonts and images, inspect the saved pixels, and distinguish deliberate loading/error states. Include source, viewport, phase, and timestamp when known. Keep credentials, sensitive request bodies, and private data out of captions, logs, screenshots, and exports; the CLI also redacts recognized secrets. Historical imports must say that prior checks were not rerun.

At completion, finalize to generate the gallery, PDF, and ZIP, inspect the rendered gallery and representative PDF pages, and open the report in the Codex in-app browser. Preserve the report tab for Daniel. Reuse a matching loopback server; `serve` prefers port 5588. Completed reports are immutable, so a follow-up task starts a new run. Generated evidence stays uncommitted.

Follow every repository's own tests, issue workflow, and release requirements. A local report does not authorize or imply production promotion.
