import { expect, test } from '../../../../../test/support/browserTest';
import { catalogFixtureMedia } from '../support/component-previews/catalogFixtureMedia';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

// gallery-2 restyles the evidence gallery, so the catalog preview whose markup it styles is the
// evidence grid. gallery.css sets `align-items: start` there; gallery-2 overrides it to `stretch`.
const host = 'reports.component.evidence-grid';
// A stylesheet has one look: the gallery as its host renders it. Its breakpoints are the viewports.
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
		test(`reports.style.gallery-2:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, host, state.variant);
			const content = await readyPreview(page, host, state.variant);
			await expect(
				content.getByRole('heading', { level: 2, name: 'Evidence gallery', exact: true })
			).toBeVisible();
			// Painted treatments that only gallery-2's own rules produce, not the gallery stylesheet.
			await expect(content.locator('.gallery-section .evidence-grid')).toHaveCSS(
				'align-items',
				'stretch'
			);
			await expect(content.locator('.gallery-section .evidence-card').first()).toHaveCSS(
				'flex-direction',
				'column'
			);
			await expect(content.locator('.view-hint').first()).toHaveCSS('position', 'absolute');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
