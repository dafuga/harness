import { sha } from './shellData';
import { expect, type Locator, type Page } from '@playwright/test';
import { captureShell, shellOrigin, openShellPage } from './shellFixture';
import { fits, pictured } from './sharedSelect';

import { box, combo, styled } from './shellGeometry';
export {
	box,
	combo,
	styled,
	channels,
	reachable,
	compactRevision,
	navigationSpacing,
	revisionDivider
} from './shellGeometry';

/** Code opens a horizontal category row below the primary navigation. */
export async function moduleNavigation(
	page: Page,
	home: string,
	screen: string,
	scoped: string
): Promise<void> {
	const bar = page.getByRole('banner');
	const trigger = bar.getByRole('link', { name: 'Code', exact: true });
	const modules = bar.getByRole('tablist', { name: 'Code categories' });
	await trigger.click();
	await pictured(page, `explorer-shell-modules-${screen}`);
	await captureShell(page, home, { state: 'modules', viewport: screen });
	await expect(page).toHaveURL(`${shellOrigin}${scoped}/components`);
	await expect(trigger).toHaveAttribute('aria-current', 'page');
	await expect(modules).toBeVisible();
	await expect(bar.locator('[popover], [popovertarget]')).toHaveCount(0);
	const tabs = modules.getByRole('tab');
	await expect(tabs).toHaveText([
		'APIs',
		'Layouts',
		'Components',
		'Models',
		'Services',
		'Helpers',
		'Types',
		'Configs',
		'Styles',
		'Dependencies',
		'Users & Permissions',
		'Plugins'
	]);
	const [row, primary] = await Promise.all([box(modules), box(bar.locator('.hx-categories'))]);
	expect(row.y, 'module categories sit below the primary row').toBeGreaterThanOrEqual(
		primary.y + primary.height
	);
	const places = await Promise.all((await tabs.all()).map(box));
	for (const [index, place] of places.entries()) {
		expect(
			Math.abs(place.y - places[0].y),
			'module categories share one horizontal row'
		).toBeLessThan(2);
		if (index) expect(place.x).toBeGreaterThan(places[index - 1].x);
	}
	await page.keyboard.press('Escape');
	await expect(modules).toBeVisible();
	await codeDestinations(page, modules, scoped);
}

/** Each additional Code destination retains the current branch and commit scope. */
async function codeDestinations(page: Page, row: Locator, scoped: string): Promise<void> {
	for (const [name, path] of [
		['APIs', 'apis'],
		['Users & Permissions', 'permissions'],
		['Plugins', 'plugins'],
		['Configs', 'configs'],
		['Styles', 'styles'],
		['Dependencies', 'dependencies'],
		['Types', 'types']
	]) {
		const tab = row.getByRole('tab', { name, exact: true });
		await tab.click();
		await expect(page).toHaveURL(`${shellOrigin}${scoped}/${path}`);
		await expect(tab).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('link', { name: 'Code', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
	}
}

/** Package tables retain distinct declarations and search workspace origins at every viewport. */
export async function dependencyTables(
	component: Locator,
	page: Page,
	width: number,
	mobile = false
) {
	await expect(
		component.getByRole('table', { name: 'npm dependencies' }),
		'Project dependencies include declarations'
	).toBeVisible();
	await expect(component.getByRole('table', { name: 'Cargo dependencies' })).toBeVisible();
	const npm = component.getByRole('table', { name: 'npm dependencies' });
	await expect(npm.locator('tbody tr')).toHaveCount(3);
	await expect(npm).toContainText('^4.0.0');
	await expect(npm).toContainText('^3.0.0');
	await expect(npm).toContainText('Development');
	const search = component.getByRole('searchbox', { name: 'Search dependencies' });
	await search.fill('packages/web/package.json');
	await expect(component.locator('tbody tr')).toHaveCount(1);
	await expect(component.locator('tbody')).toContainText('zod');
	await search.fill('no-matching-package');
	await expect(component.getByText('No dependencies match this search.')).toBeVisible();
	await component.getByRole('button', { name: 'Clear search' }).click();
	await expect(component.locator('tbody tr')).toHaveCount(4);
	if (mobile)
		await expect
			.poll(() =>
				npm.locator('tbody').evaluate((body) => {
					const frame = body.closest('.dep-scroll')!;
					return frame.scrollWidth <= frame.clientWidth;
				})
			)
			.toBe(true);
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
		.toBeLessThanOrEqual(width);
}

/** The line under a category: how thick it is and what colour; nothing when there is none. */
export const underline = (locator: Locator) =>
	locator.evaluate((element) => {
		const style = getComputedStyle(element, '::after');
		return style.content === 'none' ? null : [parseFloat(style.height), style.backgroundColor];
	});
/** Opens the bar over the made-up history and waits for the name both headers show. */
export async function openNavbar(
	page: Page,
	home: string,
	width: number,
	height: number
): Promise<Locator> {
	await page.setViewportSize({ width, height });
	await openShellPage(page, home, 'navbar');
	await expect(page.getByText('Harness', { exact: true }).first()).toBeVisible();
	return page.getByRole('banner');
}

/** Chooses an earlier commit, then opens Helpers there with the keyboard. */
export async function earlierFunctions(page: Page, bar: Locator, earlier: string) {
	const functions = bar
		.getByRole('tablist', { name: 'Code categories' })
		.getByRole('tab', { name: 'Helpers', exact: true });
	await expect(combo(bar, 'Commit')).toBeVisible();
	await combo(bar, 'Commit').selectOption(sha(3));
	await expect(page).toHaveURL(`${earlier}/pages`);
	await bar.getByRole('link', { name: 'Code', exact: true }).click();
	await functions.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(`${earlier}/functions`);
	return functions;
}
