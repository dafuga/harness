import { expect, test, type Locator } from '../../../../../test/support/browserTest';
import { prepareCatalogState } from '../support/component-previews/catalogStateActions';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

// The platform screen imports platforms.css, so its catalog preview paints these rules.
const host = 'reports.component.explorer-ui-explorer-platforms';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'status-options-open', variant: 'status-options-open' },
	{ id: 'card-hovered', variant: 'card-hovered' },
	{ id: 'card-focused', variant: 'card-focused' },
	{ id: 'unindexed', variant: 'unindexed' },
	{ id: 'detail-web', variant: 'detail-web' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.platforms:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, host, state.variant);
			await expect(page.locator('#preview-title')).toHaveText('ExplorerPlatforms');
			const component = await readyPreview(page, host, state.variant);
			await prepareCatalogState(component, host, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await proveState(state.id, component);
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}

/** Each state is proved by the painted treatment its own stylesheet rule gives it. */
async function proveState(id: string, component: Locator) {
	if (id === 'default') {
		await expect(component.locator('.pf-card')).toHaveCount(4);
		await expect(component.locator('.pf-grid')).toHaveCSS('display', 'grid');
		await expect(component.locator('.pf-controls')).toHaveCSS('display', 'flex');
		await expect(component.locator('.pf-status').first()).toHaveCSS('white-space', 'nowrap');
	}
	if (id === 'status-options-open') {
		const select = component.getByRole('combobox', { name: 'Status filter', exact: true });
		await expect(select).toHaveCSS('appearance', 'base-select');
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
		await expect
			.poll(() =>
				select.evaluate((node) => getComputedStyle(node, '::picker(select)').borderTopStyle)
			)
			.toBe('solid');
	}
	if (id === 'card-hovered') {
		const rest = await component
			.locator('.pf-card:not(:hover) .pf-chevron')
			.first()
			.evaluate((node) => getComputedStyle(node).color);
		await expect(component.locator('.pf-card:hover')).toHaveCount(1);
		await expect(component.locator('.pf-card:hover .pf-chevron')).not.toHaveCSS('color', rest);
	}
	if (id === 'card-focused') {
		const link = component.getByRole('link', { name: 'View Web configuration', exact: true });
		await expect.poll(() => link.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
		await expect
			.poll(() => link.evaluate((node) => getComputedStyle(node, '::after').outlineStyle))
			.toBe('solid');
	}
	if (id === 'unindexed') {
		await expect(component.locator('.pf-notice')).toHaveCSS('border-top-style', 'dashed');
		const pills = component.locator('.pf-status[data-status="not-recorded"]');
		await expect(pills).toHaveCount(4);
		await expect(pills.first()).toHaveCSS('border-top-style', 'dashed');
	}
	if (id === 'detail-web') {
		await expect(component).toContainText('orders-web');
		await expect(component.locator('.pf-sections')).toHaveCSS('display', 'grid');
		await expect(component.locator('.pf-meta')).toHaveCSS('display', 'flex');
		const table = component.getByRole('table', {
			name: 'Web deployment configuration',
			exact: true
		});
		await expect(table).toBeVisible();
	}
}
