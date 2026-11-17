import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/**
 * The workspace-1 stylesheet is drawn through the game workspace chips: the Game route loads
 * these rules beside the chips, and the preview paints them with the same rules.
 */
const unit = 'desktop.component.game-authoring-game-workspace-chips';
/** The default chip is the unsaved-changes chip; its shape comes from the `.chip` rule here. */
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.workspace-1:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			const chip = content.getByText('Unsaved changes', { exact: true });
			await expect(chip).toBeVisible();
			// The rounded corners are the `.chip` rule of this stylesheet, read from the same token.
			const radius = await page.evaluate(() => {
				const probe = document.createElement('span');
				probe.style.borderRadius = 'var(--hx-radius-xlarge)';
				document.body.append(probe);
				const value = getComputedStyle(probe).borderRadius;
				probe.remove();
				return value;
			});
			await expect(chip, 'the chip takes the radius of the workspace-1 rule').toHaveCSS(
				'border-radius',
				radius
			);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
