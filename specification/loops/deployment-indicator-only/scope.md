# Deployment indicator only

Remove the Changes reach preprod guidance from desktop and mobile headers. Keep the last verified deployment commit/time and the existing environment selector. Running deployment progress belongs in the top-right light and its existing shared modal with concurrent destinations, routes and step details. No deployment authorization, adapter, backend or promotion boundary change.

Direct edit: desktop.component.environment-picker. Checked dependency: desktop.component.deployment-activity, already responsible for the pulsing icon and modal; reuse ChoiceDialog and DeploymentDetails. NavBar uses both pickers; existing state and callbacks remain intact.

Strengthen existing workspace selector coverage to require the guidance absent after selecting prod at320/390px, capturing the same checkpoint before the assertion. Existing concurrent activity coverage additionally requires an icon-only closed trigger, no progress copy in the banner, hidden modal until clicked, then correct destination/step detail and return focus on close. The activity behavior already exists; do not claim it as new or manufacture red proof for it. Run unchanged red/green regression, affected browser/component/static checks and required root check; inspect fresh production header and activity-modal screenshots.

Test review: the first activity assertion read text from a closed native dialog. Correct it to assert visible progress text before any product change; hidden modal content is expected. Only the guidance-removal scenario supplies defect red evidence.
