import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import * as preview from '../support/component-previews/previewPage';
import { catalogViewports } from '../support/component-previews/catalogUnits';

const unit = 'desktop.component.design-panel';
const states = [{ id: 'default', variant: 'long' }];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.design-2:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await preview.openPreview(page, home, unit, state.variant);
			const content = await preview.readyPreview(page, unit, state.variant);
			const options = content.locator('.design-options');
			await expect(options).toBeVisible();
			await expect
				.poll(() =>
					options.evaluate((node) => getComputedStyle(node).display)
				)
				.toBe('flex');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
