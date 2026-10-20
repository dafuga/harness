import { mount, unmount, tick } from 'svelte';
import CatalogPreviews from '../component-previews/CatalogPreviews.svelte';
import '../../../../src/lib/styles/base.css';
import '../../../../src/lib/styles/base-2.css';
import '../../../../src/lib/styles/base-3.css';
import '../../../../src/lib/styles/harness.css';
import '../../../../src/lib/styles/gallery.css';
import '../../../../src/lib/styles/gallery-2.css';
import '../../../../src/lib/styles/provider-picker.css';
import '../../../../src/lib/styles/analytics.css';
import '../../../../../desktop/src/lib/styles/workspace.css';
import '../../../../../desktop/src/lib/styles/design.css';
import '../../../../../hub/src/lib/styles/hub.css';
document.body.dataset.pickerPreview = 'true';
const unitId =
	new URLSearchParams(location.search).get('unit') ?? 'reports.component.activity-list';
let mounted: ReturnType<typeof mount> | undefined;
declare global {
	interface Window {
		previewRemount: () => Promise<void>;
	}
}
window.previewRemount = async () => {
	if (mounted) await unmount(mounted);
	mounted = mount(CatalogPreviews, {
		target: document.getElementById('app')!,
		props: { id: unitId }
	});
	await tick();
};
void window.previewRemount();
