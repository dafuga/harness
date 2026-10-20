import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, removeShellFixture } from './support/shellFixture';
import { catalogUnits, catalogViewports } from './support/component-previews/catalogUnits';
import {
	openPreview,
	readyPreview,
	capturePreview
} from './support/component-previews/previewPage';
import { profilePreview } from './support/component-previews/profilePreview';
import { profileConfiguration } from './support/component-previews/profileConfiguration';
let home = '';
test.beforeAll(async () => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
	await profileConfiguration();
});
test.afterAll(() => removeShellFixture(home));
for (const viewport of catalogViewports) {
	for (const unit of catalogUnits) {
		test(`${unit.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await openPreview(page, home, unit.id);
			await expect(page.locator('#preview-title')).toHaveText(unit.title);
			const component = await readyPreview(page, unit.id);
			if (unit.id === 'reports.component.provider-picker-cards') {
				await expect(component.getByText('GPT 6.1', { exact: true })).toBeVisible();
				await expect(component.getByText('Claude Opus 5.5', { exact: true })).toBeVisible();
			}
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			await capturePreview(page, home, unit.id, viewport.id);
			if (viewport.id === 'desktop') await profilePreview(page, unit.id);
		});
	}
}
