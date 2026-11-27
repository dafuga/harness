import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const previewUnit = 'reports.component.contract-table';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.component.shared-primitives-contract-table-mobile:${state.id} at ${viewport.id}`, async ({
			page
		}) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, previewUnit, state.variant);
			const component = await readyPreview(page, previewUnit, state.variant);
			const row = component.locator('[data-harness-component="contract-table"] tbody tr').first();
			await expect(row).toBeVisible();
			await expect
				.poll(() => row.evaluate((element) => getComputedStyle(element).display))
				.toBe(viewport.width <= 900 ? 'grid' : 'table-row');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
