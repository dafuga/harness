import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const previewUnit = 'reports.component.evidence-grid';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.gallery:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, previewUnit, state.variant);
			const component = await readyPreview(page, previewUnit, state.variant);
			const gallerySection = component.locator('.gallery-section').first();
			await expect(gallerySection).toBeVisible();
			await expect(gallerySection).toHaveCSS('scroll-margin-top', '16px');
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
