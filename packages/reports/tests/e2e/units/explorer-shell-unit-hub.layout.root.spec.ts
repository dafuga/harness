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
		test(`hub.layout.root:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, 'hub.layout.root', state.variant);
			const content = await readyPreview(page, 'hub.layout.root', state.variant);
			await expect(content).toBeVisible();
			await expect(page.locator('#preview-title')).toHaveText('Hub root layout');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
