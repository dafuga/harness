import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const unit = 'reports.component.explorer-ui-harness-explorer-styles-screen';
const states = [{ id: 'default', variant: '' }];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.explorer-styles:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			await expect(
				page.getByRole('heading', { level: 1, name: 'Styles', exact: true })
			).toBeVisible();
			const baseSwatch = content.locator('.hx-style-base .hx-style-swatch').first();
			await expect(baseSwatch).toBeVisible();
			await expect(baseSwatch).toHaveCSS('width', '56px');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
