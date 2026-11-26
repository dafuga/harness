import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

// The explorer frame imports this stylesheet and every catalog page loads it, so the history preview
// (drawn in the explorer content) shows these rules. Only the long variant carries change notes, so
// the selected-change state opens the first of them.
const unit = 'reports.component.harness-entity-history';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'selected-change', variant: 'long' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity-history:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			const table = content.getByRole('table', { name: /^History of / });
			await expect(table).toBeVisible();
			// Separate borders let the rounded frame show; the DataTable rule collapses them.
			await expect(table).toHaveCSS('border-collapse', 'separate');
			await expect(table.locator('tbody td').first()).toHaveCSS('white-space', 'nowrap');
			await expect(table.locator('td.ex-said').first()).toHaveCSS('min-width', '200px');
			if (state.id === 'selected-change') {
				const reasons = content.locator('details.ex-full').first();
				await reasons.locator('summary').click();
				await expect(reasons).toHaveJSProperty('open', true);
				await expect(reasons.getByText('What changed', { exact: true })).toBeVisible();
				await expect(reasons.locator('.ex-eyebrow').first()).toHaveCSS(
					'text-transform',
					'uppercase'
				);
				await expect(reasons.locator('summary')).toHaveCSS('min-height', '32px');
			}
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
