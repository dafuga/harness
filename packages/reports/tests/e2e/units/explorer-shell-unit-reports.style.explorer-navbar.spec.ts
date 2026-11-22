import type { Locator } from '@playwright/test';
import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import * as preview from '../support/component-previews/previewPage';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';

// This stylesheet is imported by harness.css, which the catalog page imports, so the navbar
// catalog unit is the preview that applies its rules. Each state is one variant of that preview.
const unit = 'reports.component.harness-harness-navbar';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'pages', variant: 'pages' },
	{ id: 'historical', variant: 'historical' },
	{ id: 'unresolved', variant: 'unresolved' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.explorer-navbar:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await preview.openPreview(page, home, unit, state.variant);
			const content = await preview.readyPreview(page, unit, state.variant);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await expectStyleRules(content.locator('.hx-nav'), viewport.width);
			await expectShownState(content, state.id, viewport.width);
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}

/** Computed values that only this stylesheet sets, for the width the bar is drawn at. */
async function expectStyleRules(bar: Locator, width: number) {
	const phone = width <= 720;
	const categories = bar.getByRole('navigation', { name: 'Harness categories', exact: true });
	await expect(bar).toHaveCSS('min-height', phone ? '0px' : '92px');
	await expect(categories).toHaveCSS('flex-wrap', phone ? 'nowrap' : 'wrap');
	await expect(categories).toHaveCSS('overflow-x', phone ? 'auto' : 'visible');
	await expect(categories.locator(':scope > *').first()).toHaveCSS(
		'min-height',
		phone ? '60px' : '64px'
	);
	await expect(bar.locator('.hx-repository')).toHaveCSS('text-overflow', 'ellipsis');
	const divider = await categories.evaluate((node) => getComputedStyle(node, '::before').display);
	expect(divider, 'The rule between the brand and the categories is hidden below 1420px').toBe(
		'none'
	);
}

/** What each state shows that the others do not, and the controls kept on the screen. */
async function expectShownState(content: Locator, id: string, width: number) {
	const bar = content.locator('.hx-nav');
	const categories = bar.getByRole('navigation', { name: 'Harness categories', exact: true });
	const tabs = content.getByRole('tablist', { name: 'Code categories', exact: true });
	const commit = content.getByRole('combobox', { name: 'Commit', exact: true });
	if (id === 'unresolved') {
		// Without an address the categories are dimmed and cannot be followed, and nothing is revised.
		await expect(categories.getByRole('link')).toHaveCount(0);
		await expect(categories.locator('.hx-category').first()).toHaveCSS('opacity', '0.55');
		await expect(bar.getByRole('button', { name: /Search/ })).toHaveCount(0);
		await expect(commit).toHaveCount(0);
		await expect(tabs).toHaveCount(0);
		return;
	}
	const current = categories.locator("[aria-current='page']");
	await expect(current).toHaveCount(1);
	const marker = await current.evaluate((node) => getComputedStyle(node, '::after').height);
	expect(marker, 'The current category carries its underline marker').toBe('3px');
	await expect(commit).toBeVisible();
	await insideScreen(commit, width);
	await insideScreen(bar.getByRole('button', { name: /Search/ }), width);
	if (id === 'default') {
		await expect(categories.getByRole('link', { name: 'Code', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(tabs).toBeVisible();
		await expect(content.getByRole('button', { name: 'Go to tip', exact: true })).toBeDisabled();
		await expect(bar.locator('.hx-repository')).toHaveText('Northstar Store');
	}
	if (id === 'pages' || id === 'historical') {
		// Pages is the category in view here, so no module tab strip is drawn under the bar.
		await expect(categories.getByRole('link', { name: 'Pages', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(tabs).toHaveCount(0);
	}
	if (id === 'historical') {
		await expect(bar.locator('.hx-history-state')).toHaveText('Historical commit');
		await expect(content.getByRole('link', { name: 'Go to tip', exact: true })).toBeVisible();
	}
}

/** A control the bar keeps on the screen lies inside the width of the viewport. */
async function insideScreen(control: Locator, width: number) {
	const box = await control.boundingBox();
	if (!box) throw new Error('A control the bar keeps has no box to measure.');
	expect(box.x, 'The control starts on the screen').toBeGreaterThanOrEqual(0);
	expect(box.x + box.width, 'The control ends on the screen').toBeLessThanOrEqual(width);
}
