# Feature: Concise page details

Pages open with their name, role and verification mark. The screenshot panel keeps a concise
heading, viewport buttons and the image. Purpose and route details remain in Contract. Scenario
and state selection belong in States; the overview has no commit-change action or repeated prose.

## Acceptance Criteria

- Page headers omit purpose prose and app-route metadata; other entity headers retain them.
- Screenshot overviews omit Scenario and State dropdowns, repeated explanatory text and View commit changes.
- A declared page preview selects its own scenario and state; viewport buttons keep that identity.
- Validated unchanged captures remain visible with their original commit; rejected or missing media remains a gap.
- Overview, Contract, Used In, Uses, States, History and Source retain navigation and have fresh screenshots.
- Standardized entity-preview coverage proves desktop, tablet and mobile behavior before and after the repair.

## Coverage gap

The existing visual-overview tests proved image placement but did not constrain overview copy or
controls. The inherited-capture test covered an invalid origin, but not validated unchanged proof.
Strengthen those same tests and capture every page tab; do not add a separate bug-specific suite.
