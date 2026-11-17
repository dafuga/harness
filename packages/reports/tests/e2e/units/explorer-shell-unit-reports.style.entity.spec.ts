import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * The base of the explorer content (entity.css), rendered through the catalog unit whose frame
 * imports it. Each state is one look of that base: the missing-registry card and the platform
 * declarations, which lay out in the same `.ex-content` root.
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
				await expect(content.getByText('No registry at this revision', { exact: true })).toBeVisible();
				await expect(content.locator('.ex-content .ex-lead').first()).toBeVisible();
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
