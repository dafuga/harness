import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const previewUnit = 'reports.component.activity-list';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.analytics:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, previewUnit, state.variant);
			const preview = await readyPreview(page, previewUnit, state.variant);
			await preview.evaluate((root) => {
				const card = document.createElement('article');
				card.className = 'analytics-card analytics-accent';
				card.innerHTML =
					'<p class="analytics-label">Analytics preview</p><strong class="analytics-value">42</strong>';
				root.append(card);
			});
			const card = preview.locator('.analytics-card');
			await expect(card).toBeVisible();
			await expect.poll(() => card.evaluate((node) => getComputedStyle(node).display)).toBe('grid');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
