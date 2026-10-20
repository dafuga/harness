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
