# Component capture framing

Daniel requested component-only screenshots and explicitly limited delivery to basic checks.

The existing `component-catalog-previews` matrix now compares saved PNG dimensions with compact,
multi-root and dialog geometry. Its EnvironmentPicker desktop case failed before repair: a 142px
control produced a 920px-wide page image, exceeding the 160px framing allowance. The same case
passes after repair with a 158×50 image. Native capture bytes were inspected outside Git.

Focused integrated checks:

- 18 registered browser cases passed: EnvironmentPicker, DeploymentRoute, DeploymentDialog,
  AccountMenu, HarnessIcon and ExplorerLayout at desktop/tablet/mobile. Layout context retains
  the child slot and persistent project chat.
- 10 coverage cases passed: explicit element bounds survive wire/stored schemas, decoded pixels
  match bounds at integer/fractional scales, and existing viewport/full-page and build checks remain.
- Root TypeScript and Reports preview Svelte checks passed.
- Root audit passes after the coordinator-authorized removal of one blank line from the inherited
  `test/console-host-routes.e2e.test.ts` size violation; every assertion is unchanged, and formatting
  and ESLint pass. The coordinator also requested removal of six blank lines from the inherited
  Reports shell test size violation; every nonblank line is identical to main. Both audits pass.
  Two inherited over-limit helper spans and the Styles file were also reduced with whitespace
  and one reused Types locator; all assertions remain. The existing desktop navbar case passes.
  No unrelated behavior or size-limit relaxation was included here.

Formal isolated regression recording, full CLI/native/workspace suites and exhaustive capture
qualification were deferred under Daniel's basic-check instruction. The loop's enforced
red/green record steps remain pending; these diagnostic runs are not a sealed regression pair.

Publication must regenerate component screenshots using the new element capture mode. Existing
historical page-sized images retain their original provenance and must not be relabeled as new
component captures. The shared preview remains owned by Platforms; no additional server was started.

Follow-up: the normal evidence-producing EnvironmentPicker case now also checks that its recorded
slot is declared as element evidence. It failed with the old unit-ID slot and passed unchanged
after the producer used the scenario's `screens` slot (1 case, 9.4s). This prevents cropped images
from missing the required slot or being interpreted as viewport images. The original geometry
and source/build assertions remain in place; this is focused proof, not full scenario verification.
