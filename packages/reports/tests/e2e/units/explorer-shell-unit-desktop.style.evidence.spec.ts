import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { catalogViewports } from '../support/component-previews/catalogUnits';

/**
 * The evidence stylesheet is loaded by the desktop host (design.css imports it). The coverage
 * panel is the catalog unit whose preview applies its `.coverage-panel > .row` rule.
 */
const unit = 'desktop.component.coverage-panel';
const states = [{ id: 'default', variant: '' }] as const;

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.evidence:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			const row = content.locator('.coverage-panel > .row').first();
			await expect(row).toBeVisible();
			await expect(row).toHaveCSS('flex-wrap', 'wrap');
			await expect(row).toHaveCSS('border-bottom-style', 'solid');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
