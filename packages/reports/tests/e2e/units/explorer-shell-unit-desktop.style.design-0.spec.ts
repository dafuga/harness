import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/**
 * desktop.style.design-0 styles the entity layout, heading, tabs and thread column. The catalog
 * unit that applies these rules is desktop.component.entity-view: its preview loads design.css,
 * which imports this stylesheet. Its default opens the conversation beside the entity, and the
 * conversation-closed variant leaves the entity alone.
 */
const unit = 'desktop.component.entity-view';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'conversation-closed', variant: 'conversation-closed' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.design-0:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			const layout = content.locator('.entity-layout');
			await expect(layout).toBeVisible();
			// Only design-0.css sets the entity layout's grid display.
			expect(await layout.evaluate((node) => getComputedStyle(node).display)).toBe('grid');
			if (state.id === 'default') {
				await expect(layout).toHaveClass(/with-thread/);
				await expect(content.getByRole('button', { name: 'Close conversation' })).toBeVisible();
			} else {
				await expect(layout).not.toHaveClass(/with-thread/);
				await expect(
					content.getByRole('button', { name: 'Conversation', exact: true })
				).toBeVisible();
			}
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
