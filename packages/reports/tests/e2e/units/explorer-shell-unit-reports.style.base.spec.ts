import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture
} from '../support/shellFixture';

// The base stylesheet has one look of its own: the document's root colour scheme, set by base.css.
// The activity shell page imports this stylesheet and renders the list that shows it.
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['activity']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.base:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openShellPage(page, home, 'activity');
			await expect(page.getByRole('list', { name: 'Recent activity', exact: true })).toBeVisible();
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			// base.css sets `:root { color-scheme: dark }`; no other stylesheet in this page overrides it.
			await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
