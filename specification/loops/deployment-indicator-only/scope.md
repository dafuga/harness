# Deployment indicator only

Remove the Changes reach preprod guidance from desktop and mobile headers. Keep the last verified deployment commit/time and the existing environment selector. Running deployment progress belongs in the top-right light and its existing shared modal with concurrent destinations, routes and step details. No deployment authorization, adapter, backend or promotion boundary change.

Direct edit: desktop.component.environment-picker. Checked dependency: desktop.component.deployment-activity, already responsible for the pulsing icon and modal; reuse ChoiceDialog and DeploymentDetails. NavBar uses both pickers; existing state and callbacks remain intact.

Strengthen existing workspace selector coverage to require the guidance absent after selecting prod at320/390px, capturing the same checkpoint before the assertion. Existing concurrent activity coverage additionally requires an icon-only closed trigger, no progress copy in the banner, hidden modal until clicked, then correct destination/step detail and return focus on close. The activity behavior already exists; do not claim it as new or manufacture red proof for it. Run unchanged red/green regression, affected browser/component/static checks and required root check; inspect fresh production header and activity-modal screenshots.

Test review: the first activity assertion read text from a closed native dialog. Correct it to assert visible progress text before any product change; hidden modal content is expected. Only the guidance-removal scenario supplies defect red evidence.

## Verification outcome

Product `da01185e9362207463ad81be99090d11f2ed57fe`:32 affected browser checks,9 component tests and desktop type/lint/build/audit pass. Corrected red `7c42a26622c04233675857989d968d41827eceb9` fails guidance absence; unchanged green passes in immutable snapshots. Manual synthetic320pxprod header, active light, concurrent deployment modal and current-step detail inspected; no console errors. Only EnvironmentPicker product source changes, and its template/style reasons pass explain check.

Current root check passed format/types/lint/Rust and890 unit tests with25 skipped. Its CLI phase has hit the previously failing verify-range fixture tests and is still running; no completed full-suite result is claimed. Full verification remains pending, with later pipeline stages not reached. Landing follows Daniel's earlier instruction to merge these non-production deployment changes despite known verification failures. No actual application deployment or physical-device proof.
