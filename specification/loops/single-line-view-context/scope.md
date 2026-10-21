# Single-line viewed context

Show one summary line containing only the viewed branch name, explicit commit short SHA, or selected environment name, followed by its source-specific updated timestamp. Branch time comes from its tip commit; commit time comes from that commit; environment time comes from its verified deployment receipt. Do not show a separate deployed receipt or Current/Tip labels. Preserve shared selectors, icons, deployment progress modals, production promotion guards, border and padding.

Environment selection opens its verified deployed revision without deploying anything; branch and commit choices leave environment viewing. Missing receipts must not falsely label another revision as that environment.

The existing standardized workspace selectors scenario checked collapsed controls and mobile bounds but never asserted mutually exclusive context or timestamp provenance. Strengthen it and the existing pinned-tip navigation scenario at 320/390 widths. Capture matching before/after screenshots and assert the summary stays on one line. No new controls or shared imports are needed.

Direct units: RevisionPicker, EnvironmentPicker, deployments store and responsive CSS. Workspace and NavBar dependencies are inspected; no edits are planned there. This precisely specified layout requires no new subjective visual design.
