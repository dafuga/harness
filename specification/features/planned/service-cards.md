# Feature: Service Cards

## Overview

Services match the Helpers card grid. Each card shows its class or service name and a smaller Used In row, with links that retain the selected branch and commit.

## Acceptance Criteria

- Services use the existing responsive Helpers card grid on desktop, tablet and mobile.
- Cards show only the class or service name and up to three Used In links, without descriptions, execution targets, badges or extra actions.
- Classes use the implementation symbol matching their owned source file; services without one keep their registered name. Options and result types never replace the class name.
- Search finds both the displayed symbol and the registered name.
- Service and consumer links retain branch and commit; no consumers show a dash.

## Future Enhancements

- None.

## Process Prevention

The first implementation at `8c15da72` assumed the first owned export named the class. Live catalog review exposed options types before classes. The original standard fixture held only one export, so the identity assertion never challenged that assumption.

The shared entity fixture now places unrelated options and result types around every service implementation symbol. The existing card unit coverage and three-viewport browser matrix assert the implementation label and its owning service link. The catalog review rule in the Reports README requires that fixture whenever exported symbols determine a card label. This strengthens an existing acceptance checkpoint without adding a workflow.

## Verification

The local UI implementation is committed at `13838843`, with the initial card change at `8c15da72`. The Reports check passes 610 tests, type checks, lint, builds and audit. Both card/navigation and 1,000-row responsiveness pass at desktop, tablet and mobile widths. Real catalog search and class/consumer navigation retain branch scope.

Full root verification remains blocked by the existing `entityMeasure` and `entityShown` ownership-definition guard at unchanged `main` (`cd36c21c`); the same failure was reproduced there. Later root stages are unrun, both loop verification steps remain pending, and the active evidence report is unpublished. This branch is not merged or deployed.

## Changed Units

- [Catalog grid](http://127.0.0.1:5731/harness/branch/dafuga%2Fservice-cards/components/reports.component.harness-explorer-catalog-screen) ([History](http://127.0.0.1:5731/harness/branch/dafuga%2Fservice-cards/components/reports.component.harness-explorer-catalog-screen?tab=history)): reuses the Helpers grid for Services at `8c15da72`.
- [Shared card](http://127.0.0.1:5731/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card) ([History](http://127.0.0.1:5731/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card?tab=history)): supports service names and revision-scoped usage links at `8c15da72`.
- [Catalog data source](../../../packages/reports/src/utils/entityCatalog.ts): resolves consumer links and owned implementation labels at `8c15da72` and `13838843`. Registered unit `reports.function.entity-catalog` has no standalone explorer page under the helper inclusion rules, so no explorer History link is claimed.

The browser preview serves frozen build `1df1218e09a9f26cb8ba652447a49cbcf82615f50cb8dd1124eb752edee9f1b1`, with UI code at `13838843`. Its limited source index explicitly states that older commits were omitted. These are local browser results, not a deployed application release or device proof.
