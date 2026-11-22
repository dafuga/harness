import { expect, test } from '../../../test/support/browserTest';
import {
	evidenceRequested,
	recordCapture
} from '../../../src/utils/reports-media/record-capture/recordCapture';
import { previewIdentity } from './entityPreviewCapture';
import { fits, open, ready, viewports } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

// The selected commit has no verification record, yet the store still declares a Wasm target.
const route = { category: 'services' as const, entity: ids.store, commit: commits.middle };
const evidence = 'unrecorded-measure-screens';
const state = 'reports-component-harness-entity-overview-unrecorded-wasm';

for (const [viewport, size] of Object.entries(viewports)) {
	test(`an unrecorded commit shows the declared Wasm size as Not measured at ${viewport}`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		await open(tab, route, 'unrecorded-measures');
		await ready(tab);
		const profile = tab.getByRole('region', { name: 'Performance profile', exact: true });
		const wasm = profile
			.locator('dl > div')
			.filter({ has: tab.locator('dt', { hasText: /^Emitted size · Wasm$/ }) });
		await expect(wasm, 'one Wasm size row in the performance profile').toHaveCount(1);
		await expect(wasm.locator('dd')).toContainText('Not measured');
		expect(await fits(tab), `${viewport} page remains within its viewport`).toBe(true);

		// Screenshots are kept only by an evidence run; an ordinary run stops after its assertions.
		if (!evidenceRequested()) return;
		const server = await tab.evaluate(
			() =>
				(window as unknown as { previewBuild?: { buildId: string; revision: string } }).previewBuild
		);
		expect(server, 'the page reports the compiled fixture it actually served').toEqual(
			await previewIdentity()
		);
		const pixels = await tab.screenshot({ fullPage: true });
		recordCapture(
			{
				evidence,
				kind: 'screenshot',
				state,
				viewport,
				file: `${evidence}-${state}-${viewport}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: server!,
				note: 'Real shared Explorer over a synthetic history; the selected commit has no verification record.'
			},
			pixels
		);
	});
}
