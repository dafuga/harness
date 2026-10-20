# Compact page action

The page action is a 36px icon link with the accessible name and hover title
“Open page”. Planned review links keep their existing labels.

The unchanged regression failed before implementation and passed afterward in
local and hosted modes at desktop, tablet and mobile sizes. It checks the compact
size, absent visible label, tooltip and keyboard navigation to the same page.
Test-owned screenshots were saved outside Git and inspected.

Passed: 18 browser checks, 17 focused desktop tests, 13 shared-import guards,
desktop types, lint, build, audit and the registry check. The rebuilt Electron
preview was reloaded without replacing its profile; its compact icon opened the
expected page, and the fresh capture was inspected.

The broader delivery remains gated. The preceding repository check at b0bd4e31
failed eight desktop tests in change replies, headless comments, native iOS
profiles and planning runs, plus a worker timeout. A new repository check is
required for the completed commit. No passing full verification or main-branch
integration is claimed here.

Opus could not perform the requested whole-catalog contract review: its existing
subscription reported a weekly limit until October 18 at 22:00 Europe/Lisbon.
Only the three components edited for this change received new plain-language
contracts. The remaining function/component contracts still need that review.
