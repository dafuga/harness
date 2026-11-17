import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * The base of the explorer content (entity.css), rendered through the catalog unit whose frame
 * imports it. Each state is one look of that base, all under the `.ex-content` root: the default
 * card (`.ex-card`, `.ex-content` grid) and the frame with no registry required, whose platform
 * declarations lay out under their own heading.
 */
const unit = 'reports.component.harness-explorer-frame';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'registry-optional', variant: 'registry-optional' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, unit, state.variant);
			const content = await preview.readyPreview(page, unit, state.variant);
			const root = content.locator('.ex-content').first();
			await expect(root).toHaveCSS('display', 'grid');
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			if (state.id === 'default') {
				const card = content.locator('.ex-content .ex-card').first();
				await expect(card.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
				await expect(card).toHaveCSS('display', 'grid');
				await expect(card).toHaveCSS('align-content', 'start');
			} else {
				const website = page.getByRole('heading', { name: 'Website', exact: true });
				await expect(website).toBeVisible();
				await expect(website).toHaveCSS('display', 'flex');
				await expect(website).toHaveCSS('margin-top', '0px');
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
