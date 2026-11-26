import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});

test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.provider-picker:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, 'reports.component.provider-picker', state.variant);
			const component = await readyPreview(
				page,
				'reports.component.provider-picker',
				state.variant
			);
			const picker = component.locator('.provider-picker').first();
			await expect(picker).toBeVisible();
			await expect(picker).toHaveCSS('display', 'grid');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
