# Mobile header framing

Daniel rejected the stripped-back header and requested visible borders, padding and better organization. Have Opus5.5 make the actual visual edits to the existing header components and responsive styles. Reuse Select, ChoiceDialog and EntitySearch; preserve environment selection, revision navigation, activity light, deployment entry points and deployment boundaries.

The standardized workspace selector scenario checked fit and branch readability, but not breathing room between project and context controls. Add an8px minimum vertical gap there and retain320px/390px dev/prod checks. Capture before the assertion. Permit up to184px local header height for the explicitly requested padding, replacing the previous164px compaction target. This is a bounded visual iteration; do not manufacture aesthetic test failures. Visually inspect the borders, grouping and padding separately from functional assertions.

Direct candidates: desktop.component.project-switcher, desktop.component.environment-picker, desktop.component.revision-picker and desktop.style.responsive. NavBar and shared controls are dependencies checked, not new UI implementations. The stylesheet has no explorer category. Read registry contracts and reverse dependencies before editing. Verify focused E2E, components, types, lint, build, audit, root check and manual browser states. No application deployment.

## Verification outcome

Product commit `6451ec508e8cacb90539ce789ba240018ff9f51e`: unchanged committed spacing regression passes after failing at `fc436b0286e168c56f46e603646d129e6713cd33`. All32 affected browser checks,9 component tests,25 registry/shared-impact/contract tests, desktop type/lint/build/audit and shared-account390/920/1440 fit checks pass. Manual compiled-fixture checks and inspected screenshots cover390pxdev and320pxprod/history, workbench, revision, Go to tip, environment, search and Deploy. Local header167.5pxdev/180.5pxprod; account row included200px. Four content-bound style reasons pass explain check; no runtime speed claim is made.

`bun run check` on that product commit passed root formatting, types, lint, Rust validation/build, then ended with885 root unit passes,25 skipped and5 failures in `test/utils/settle-processes.test.ts`. The entire unchanged file passes all6 tests when rerun alone. Its source, fixture and runtime imports are unchanged from main. Full verification stays pending; the CLI and later pipeline stages were not reached in this run. No application deployment or physical-device proof.
