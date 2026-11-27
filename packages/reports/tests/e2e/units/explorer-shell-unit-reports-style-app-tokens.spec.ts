import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

// base.css imports this token sheet and the catalog host installs base.css, so the activity list
// preview draws on the palette. The token sheet has one look: its default values.
const host = 'reports.component.activity-list';
const hostTitle = 'Activity list';
const states = [{ id: 'default', variant: '' }];
const primary = '--hx-color-primary';
const primaryValue = '#f3c33b';

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.app-tokens:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, host, state.variant);
			await expect(page.locator('#preview-title')).toHaveText(hostTitle);
			await preview.readyPreview(page, host, state.variant);
			const value = await page.evaluate(
				(name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
				primary
			);
			expect(value).toBe(primaryValue);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
