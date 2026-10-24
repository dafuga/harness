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
- Root audit reports the inherited main `test/console-host-routes.e2e.test.ts` size violation;
  no unrelated source cleanup was included here.

Formal isolated regression recording, full CLI/native/workspace suites and exhaustive capture
qualification were deferred under Daniel's basic-check instruction. The loop's enforced
red/green record steps remain pending; these diagnostic runs are not a sealed regression pair.

Publication must regenerate component screenshots using the new element capture mode. Existing
historical page-sized images retain their original provenance and must not be relabeled as new
component captures. The shared preview remains owned by Platforms; no additional server was started.
