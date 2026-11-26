import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

const states = [{ id: 'default', variant: '' }];

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.workspace-0:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			const unit = 'desktop.page.root';
			await openPreview(page, home, unit, state.variant);
			const preview = await readyPreview(page, unit, state.variant);
			await expect(preview).toBeVisible();
			await expect
				.poll(() => page.locator('body').evaluate((body) => getComputedStyle(body).margin))
				.toBe('0px');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
