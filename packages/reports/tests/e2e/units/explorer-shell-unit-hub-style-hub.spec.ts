import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * The hub stylesheet is applied to every hub.* preview. Its only rendered state here is the
 * signed-in project list of the root page: the other rules (error card, copy row, members table)
 * need data this unit does not own, so no further state is captured for it.
 */
const unit = 'hub.page.root';
const states = [{ id: 'default', variant: '' }] as const;

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`hub.style.hub:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, unit, state.variant);
			await preview.readyPreview(page, unit, state.variant);
			// hub.css sets the hub page's content column; a computed value proves its own rule applies.
			const main = page.locator('.hub-main');
			await expect(main).toHaveCSS('display', 'grid');
			await expect(main).toHaveCSS('max-width', '860px');
			await expect(page.getByRole('region', { name: 'Owned by you', exact: true })).toBeVisible();
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
