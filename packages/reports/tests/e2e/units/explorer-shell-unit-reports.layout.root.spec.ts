import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * The root layout of Reports, looked at alone: the page content it frames, and the explorer chat
 * it offers under a branch address. Its preview opens at the layout's own route, so the chat is
 * present and the child is the synthetic page the preview gives it.
 */
const unit = 'reports.layout.root';
const states = [{ id: 'default', variant: '' }] as const;

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.layout.root:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, unit, state.variant);
			const component = await preview.readyPreview(page, unit, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			// The layout renders its child slot with the page content it was given.
			await expect(component.getByText('Synthetic layout child: a fixture stands in')).toBeVisible();
			// Under a branch address the layout also offers the explorer chat, once.
			await expect(component.locator('.floating-chat-bubble')).toHaveCount(1);
			await expect(component.locator('.floating-chat-bubble')).toBeVisible();
			await page.evaluate(() => scrollTo(0, 0));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
