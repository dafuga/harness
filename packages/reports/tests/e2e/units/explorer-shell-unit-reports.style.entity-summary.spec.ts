import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const unit = 'reports.component.harness-entity-summary';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity-summary:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const preview = await readyPreview(page, unit, state.variant);
			const summary = preview.locator('.ex-summary');
			await expect(summary).toBeVisible();
			await expect(summary).toHaveCSS('display', 'grid');
			await expect(summary.getByRole('heading', { name: 'Performance profile' })).toBeVisible();
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
