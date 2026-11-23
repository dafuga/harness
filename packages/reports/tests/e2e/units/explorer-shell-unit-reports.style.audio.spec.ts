import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

const states = [{ id: 'default', variant: '' }];
const unit = 'reports.component.evidence-grid';
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.audio:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await openPreview(page, home, unit, state.variant);
			const component = await readyPreview(page, unit, state.variant);
			const audioTab = component.locator('.media-tabs').getByRole('button', {
				name: /Audio/,
				exact: false
			});
			await expect(audioTab).toBeVisible();
			await audioTab.click();
			const activeAudioTab = component.locator('.media-tabs button.active');
			await expect(activeAudioTab).toContainText('Audio');
			const activeIndicator = await activeAudioTab.evaluate(
				(button) => getComputedStyle(button, '::after').backgroundColor
			);
			expect(activeIndicator).not.toBe('rgba(0, 0, 0, 0)');
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
