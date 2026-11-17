import { expect, test } from '../../../../../test/support/browserTest';
import { catalogFixtureMedia } from '../support/component-previews/catalogFixtureMedia';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

// ExplorerFrame imports this stylesheet. The pages screen mounts that frame around the controls,
// the empty notice and the grid of page cards this style draws, so it is the host rendered here.
const unit = 'reports.component.harness-explorer-pages-screen';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'no-matches', variant: 'no-matches' },
	{ id: 'search-focused', variant: '' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
	catalogFixtureMedia(home);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.entity-index:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, unit, state.variant);
			const content = await readyPreview(page, unit, state.variant);
			const search = content.locator('.ex-search');
			const field = content.getByRole('searchbox');
			await expect(content.locator('.ex-controls')).toBeVisible();
			await expect(search).toHaveCSS('min-height', '48px');
			if (state.id === 'default') {
				const grid = content.locator('.ex-page-grid').first();
				await expect(grid).toHaveCSS('display', 'grid');
				await expect(grid.locator('.ex-page-card').first()).toBeVisible();
			}
			if (state.id === 'no-matches') {
				await field.fill('refund policy');
				await expect(content.locator('.ex-page-grid')).toHaveCount(0);
				const notice = content.locator('.ex-empty');
				await expect(notice).toContainText('No pages match this search.');
				await expect(notice).toHaveCSS('border-top-style', 'dashed');
			}
			if (state.id === 'search-focused') {
				const idle = await search.evaluate((node) => getComputedStyle(node).borderTopColor);
				await field.focus();
				await expect(field).toBeFocused();
				// The focus rule paints the token's colour; a probe inside the same frame reads it resolved.
				const gold = await search.evaluate((node) => {
					const probe = document.createElement('span');
					probe.style.borderTopColor = 'var(--ex-gold)';
					node.append(probe);
					const color = getComputedStyle(probe).borderTopColor;
					probe.remove();
					return color;
				});
				expect(gold).not.toBe(idle);
				await expect(search).toHaveCSS('border-top-color', gold);
			}
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
