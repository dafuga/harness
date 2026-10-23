import type {} from './catalogEntry.types';
import { mount, unmount, tick } from 'svelte';
import CatalogPreviews from '../component-previews/CatalogPreviews.svelte';
import base from '../../../../src/lib/styles/base.css?inline';
import base2 from '../../../../src/lib/styles/base-2.css?inline';
import base3 from '../../../../src/lib/styles/base-3.css?inline';
import harness from '../../../../src/lib/styles/harness.css?inline';
import gallery from '../../../../src/lib/styles/gallery.css?inline';
import gallery2 from '../../../../src/lib/styles/gallery-2.css?inline';
import picker from '../../../../src/lib/styles/provider-picker.css?inline';
import analytics from '../../../../src/lib/styles/analytics.css?inline';
import workspace from '../../../../../desktop/src/lib/styles/workspace.css?inline';
import design from '../../../../../desktop/src/lib/styles/design.css?inline';
import hub from '../../../../../hub/src/lib/styles/hub.css?inline';
document.body.dataset.pickerPreview = 'true';
const unitId =
	new URLSearchParams(location.search).get('unit') ?? 'reports.component.activity-list';
// Preserve the document's original unit before real route fixtures replace the visible URL.
window.previewDocument = Object.freeze({ unit: unitId, timeOrigin: performance.timeOrigin });
let styles = [base, base2, base3, harness, gallery, gallery2, picker, analytics];
if (unitId.startsWith('desktop.')) styles = [workspace, design];
if (unitId.startsWith('hub.')) styles = [workspace, design, hub];
const contextStyle = document.createElement('style');
contextStyle.dataset.previewApp = unitId.split('.')[0];
contextStyle.textContent = styles.join('\n');
document.head.prepend(contextStyle);
let mounted: ReturnType<typeof mount> | undefined;
window.previewRemount = async () => {
	if (mounted) await unmount(mounted);
	mounted = mount(CatalogPreviews, {
		target: document.getElementById('app')!,
		props: { id: unitId }
	});
	await tick();
};
void window.previewRemount();
