import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * The workspace stylesheet is applied through the Desktop root page, which imports it. Its
 * `:root` rule sets `color-scheme: dark`, which the page's computed style proves.
 */
const host = 'desktop.page.root';
const states = [{ id: 'default', variant: '' }] as const;

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.workspace:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, host, state.variant);
			await preview.readyPreview(page, host, state.variant);
			await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
