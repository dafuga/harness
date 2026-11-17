import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

/**
 * The shared controls of the explorer as the bar draws them: the revision bar with its branch and
 * commit fields, their tip and viewed labels, and the outlined tip action. The catalog preview of
 * the branch and revision selectors is the host that applies this sheet, through the console's
 * import of the stylesheets; its tip is the only place the bar's own rules show.
 */
const unit = 'reports.component.harness-harness-selectors';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'at-tip', variant: 'at-tip' }
];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.explorer-controls:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			await expect(page.locator('#preview-title')).toHaveText('Branch and revision selectors');
			const component = await readyPreview(page, unit, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));

			// The bar is divided from what precedes it by the rule of this sheet.
			const bar = component.locator('.hx-revision');
			await expect(bar).toHaveCount(1);
			await expect(bar).toHaveCSS('border-left-style', 'solid');

			// The branch and commit fields are compact: 160px and 116px wide at every size.
			const fields = bar.locator(':scope > label');
			await expect(fields).toHaveCount(2);
			const widths = await fields.evaluateAll((list) =>
				list.map((node) => getComputedStyle(node).width)
			);
			expect(widths).toEqual(['160px', '116px']);

			// The tip and viewed labels are not drawn; each field keeps them in its hover title.
			const notes = bar.locator('small');
			await expect(notes).toHaveCount(2);
			const shown = await notes.evaluateAll((list) =>
				list.map((node) => getComputedStyle(node).display)
			);
			expect(shown).toEqual(['none', 'none']);
			await expect(component.getByRole('combobox', { name: 'Branch', exact: true })).toHaveAttribute(
				'title',
				/Latest branch tip/
			);
			await expect(component.getByRole('combobox', { name: 'Commit', exact: true })).toHaveAttribute(
				'title',
				/Selected historical revision/
			);

			// The tip action is a square outlined action of the bar.
			const tip = bar.locator('.hx-action');
			await expect(tip).toHaveCount(1);
			await expect(tip).toHaveCSS('width', '32px');
			await expect(tip).toHaveCSS('height', '32px');

			if (state.id === 'at-tip') {
				// Where the tip is shown, the action is disabled and says so with its own cursor.
				const disabled = component.getByRole('button', { name: 'Go to tip', exact: true });
				await expect(disabled).toBeDisabled();
				await expect(disabled).toHaveCSS('cursor', 'not-allowed');
			} else {
				// Elsewhere the action follows the way back to the tip, as an outlined link.
				const link = component.getByRole('link', { name: 'Go to tip', exact: true });
				await expect(link).toBeVisible();
				await expect(link).toHaveCSS('border-top-style', 'solid');
			}

			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
			).toBe(true);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
