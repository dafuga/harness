import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/**
 * desktop.style.design-1 styles the thread history and version strip. The catalog unit that
 * applies these rules is desktop.component.thread-history: its preview loads design.css, which
 * imports this stylesheet.
 */
const unit = 'desktop.component.thread-history';
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.design-1:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			const history = content.locator('.thread-history');
			const strip = content.locator('.version-strip');
			await expect(history).toBeVisible();
			await expect(strip).toBeVisible();
			// Both rules come only from design-1.css: the history border and the flex version strip.
			expect(await history.evaluate((node) => getComputedStyle(node).borderBlockStartStyle)).toBe(
				'solid'
			);
			expect(await strip.evaluate((node) => getComputedStyle(node).display)).toBe('flex');
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
