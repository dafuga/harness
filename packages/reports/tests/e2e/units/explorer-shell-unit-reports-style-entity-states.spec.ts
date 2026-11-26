import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const unit = 'reports.component.entity-states';
const states = [{ id: 'default', variant: '' }];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});

test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity-states:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const component = await readyPreview(page, unit, state.variant);
			const gallery = component.locator('.states-gallery');
			await expect(gallery).toBeVisible();
			await expect(gallery).toHaveCSS('min-width', '0px');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
