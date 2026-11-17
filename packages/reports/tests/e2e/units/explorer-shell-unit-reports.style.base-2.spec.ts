import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const host = 'reports.page.harness-branch-branch-at-styles';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.base-2:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, host, state.variant);
			const preview = await readyPreview(page, host, state.variant);
			const panel = preview.locator('.panel').first();
			await expect(panel).toBeVisible();
			await expect(panel).toHaveCSS('border-radius', '24px');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
