import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

const states = [{ id: 'default', variant: 'recent' }];
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});

test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.projects:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, 'desktop.component.project-gate', state.variant);
			await readyPreview(page, 'desktop.component.project-gate', state.variant);
			const recentProjects = page.locator('.recent-projects');
			await expect(
				page.getByRole('heading', { name: 'Recent projects', exact: true })
			).toBeVisible();
			await expect(recentProjects).toBeVisible();
			expect(await recentProjects.evaluate((element) => getComputedStyle(element).display)).toBe(
				'grid'
			);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
