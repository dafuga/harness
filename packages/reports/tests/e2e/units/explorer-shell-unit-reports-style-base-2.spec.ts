import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const host = 'reports.component.evidence-card';
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
			const badge = preview.locator('.badge').first();
			await expect(badge).toBeVisible();
			await expect(badge).toHaveCSS('border-top-left-radius', '999px');
			await expect(badge).toHaveCSS('border-top-width', '1px');
			await expect(badge).toHaveCSS('font-size', '11px');
			await expect(badge).toHaveCSS('font-weight', '600');
			await expect(badge).toHaveCSS('white-space', 'nowrap');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
