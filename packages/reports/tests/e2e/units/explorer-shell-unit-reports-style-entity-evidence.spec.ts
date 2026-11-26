import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogFixtureMedia } from '../support/component-previews/catalogFixtureMedia';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

// The catalog host of this style: the screens card draws the evidence panes, the viewport choice
// and the screenshot frame that reports.style.entity-evidence styles.
const host = 'reports.component.harness-entity-screens';
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
	catalogFixtureMedia(home);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity-evidence:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, host, state.variant);
			const component = await preview.readyPreview(page, host, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));

			// Each computed value below comes from a rule of entity-evidence.css, not from the host.
			const viewports = component.getByRole('group', { name: 'Viewport', exact: true });
			await expect(viewports).toBeVisible();
			const pressed = viewports.locator('button[aria-pressed="true"]');
			await expect(pressed).toHaveCount(1);
			await expect(pressed).toHaveCSS('box-shadow', /inset/);

			const shot = component.locator('.ex-shot').first();
			await expect(shot).toBeVisible();
			await expect(shot).toHaveCSS('display', 'grid');
			await expect(shot).toHaveCSS('cursor', 'zoom-in');
			await expect(shot.locator('img')).toHaveCSS('object-fit', 'contain');

			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
