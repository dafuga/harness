import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/**
 * responsive.css is imported through design.css, which the desktop catalog host applies. The
 * catalog view's card grid takes its column count from the breakpoints of this stylesheet: two
 * columns in the 1250px and 850px bands, one at 560px and below.
 */
const unit = 'desktop.component.catalog-view';
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.responsive:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			await readyPreview(page, unit, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			const grid = page.locator(`[data-preview-unit="${unit}"] .card-grid`);
			await expect(grid).toBeVisible();
			const tracks = await grid.evaluate(
				(node) => getComputedStyle(node).gridTemplateColumns.split(' ').length
			);
			expect(tracks).toBe(viewport.id === 'mobile' ? 1 : 2);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
