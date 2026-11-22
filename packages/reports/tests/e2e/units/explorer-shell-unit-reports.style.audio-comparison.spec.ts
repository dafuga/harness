import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';

/**
 * audioComparison.css is imported by gallery.css and styles the gallery card that
 * reports.component.audio-comparison renders, so that catalog unit is the host of every state.
 */
const unit = 'reports.component.audio-comparison';

/** Each state is a distinct look of the card rules: the enabled preview, its disabled look before mount, the missing recording row, and the deep-linked outline. */
const states = [
	{ id: 'default', variant: '' },
	{ id: 'disabled', variant: 'pre-mount' },
	{ id: 'unavailable', variant: 'unavailable' },
	{ id: 'targeted', variant: '' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.audio-comparison:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, unit, state.variant);
			await expect(page.locator('#preview-title')).toHaveText('Audio comparison');
			const component = await preview.readyPreview(page, unit, state.variant);
			const card = page.locator('.audio-comparison-card');
			const opener = card.locator('.audio-comparison-preview');
			await expect(card).toHaveCount(1);

			if (state.id === 'default') {
				await expect(opener).toBeEnabled();
				// Rules from audioComparison.css: the preview is a flex column with a pointer cursor.
				await expect(opener).toHaveCSS('display', 'flex');
				await expect(opener).toHaveCSS('cursor', 'pointer');
			}

			if (state.id === 'disabled') {
				await expect(opener).toBeDisabled();
				// Rule from `.audio-comparison-preview:disabled`: a waiting cursor while the card is not ready.
				await expect(opener).toHaveCSS('cursor', 'wait');
			}

			if (state.id === 'unavailable') {
				const missing = component.locator('.audio-comparison-missing');
				await expect(missing).toHaveCount(1);
				await expect(missing).toHaveText('Audio unavailable');
			}

			if (state.id === 'targeted') {
				await expect(opener).toBeEnabled();
				const anchor = await component.locator('.audio-comparison-row').first().getAttribute('id');
				if (!anchor) throw new Error('The Before row has no gallery anchor.');
				// Deep-linking to the row runs `.audio-comparison-card:has(.audio-comparison-row:target)`.
				await page.evaluate((id) => {
					location.hash = id;
				}, anchor);
				await expect(card).toHaveCSS('outline-style', 'solid');
				await expect
					.poll(() => card.evaluate((node) => parseFloat(getComputedStyle(node).outlineWidth)))
					.toBeGreaterThan(0);
			}

			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
