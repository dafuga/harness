import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const previewUnit = 'reports.layout.explorer-layout';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});

test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.explorer:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, previewUnit, state.variant);
			const preview = await readyPreview(page, previewUnit, state.variant);
			const shell = preview.locator('.hx-shell');
			await expect(shell).toBeVisible();
			await expect
				.poll(() => shell.evaluate((element) => getComputedStyle(element).minHeight))
				.toBe(`${viewport.height}px`);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
