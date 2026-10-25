import { expect, type Locator, type Page } from '@playwright/test';
import { captureShell, shellOrigin, openShellPage } from './shellFixture';
import { fits, pictured } from './sharedSelect';

/** What the specs of the shell ask of what is drawn: where it is, and how it is styled. */
export const box = async (locator: Locator) => (await locator.boundingBox())!;
export const combo = (within: Locator, name: string) =>
	within.getByRole('combobox', { name, exact: true });
export const styled = (locator: Locator, property: string) =>
	locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
/** Red, green, blue and, when it has one, the opacity of a computed colour. */
export const channels = (colour: string) => (colour.match(/[\d.]+/g) ?? []).map(Number);

/** A control a finger can press, wholly on the screen. */
export async function reachable(control: Locator, width: number): Promise<void> {
	const place = await box(control);
	expect(place.height).toBeGreaterThanOrEqual(32);
	expect(place.x).toBeGreaterThanOrEqual(0);
	expect(place.x + place.width).toBeLessThanOrEqual(width);
}

/** Revision controls stay one small row, with native options and a readable closed value. */
export async function compactRevision(within: Locator): Promise<void> {
	const row = within.locator('.hx-revision, .revision-picker');
	const bounds = await box(row);
	expect(bounds.height, 'compact revision row').toBeLessThanOrEqual(48);
	expect(bounds.width, 'bounded revision width').toBeLessThanOrEqual(380);
	const fields = ['Branch', 'Commit'].map((name) => combo(within, name));
	for (const field of fields) expect((await box(field)).height).toBeLessThanOrEqual(36);
	expect(Math.abs((await box(fields[0])).y - (await box(fields[1])).y)).toBeLessThan(2);
}

/** Navigation and wrapped revision controls have breathing room without growing the fields. */
export async function navigationSpacing(within: Locator): Promise<void> {
	const [header, brand, categories, revision, field] = await Promise.all([
		box(within),
		box(within.getByRole('link', { name: 'Harness', exact: true })),
		box(within.locator('.hx-categories')),
		box(within.locator('.hx-revision')),
		box(combo(within, 'Branch'))
	]);
	expect(brand.y - header.y, 'space above navigation').toBeGreaterThanOrEqual(8);
	const contentBottom = Math.max(
		brand.y + brand.height,
		categories.y + categories.height,
		revision.y + revision.height
	);
	expect(header.y + header.height - contentBottom, 'space below navigation').toBeGreaterThanOrEqual(
		8
	);
	if (revision.y >= categories.y + categories.height - 1) {
		expect(field.y - revision.y, 'space above revision controls').toBeGreaterThanOrEqual(8);
		expect(
			revision.y + revision.height - field.y - field.height,
			'space below revision controls'
		).toBeGreaterThanOrEqual(8);
	}
}

/** A wrapped revision row is separated from the categories across the entire header. */
export async function revisionDivider(within: Locator): Promise<void> {
	const row = within.locator('.hx-revision');
	const [revision, categories, header] = await Promise.all([
		box(row),
		box(within.locator('.hx-categories')),
		box(within)
	]);
	const line = await row.evaluate((element) => {
		const style = getComputedStyle(element, '::before');
		return {
			content: style.content,
			height: parseFloat(style.height),
			width: parseFloat(style.width),
			left: parseFloat(style.left),
			top: parseFloat(style.top),
			color: style.backgroundColor
		};
	});
	if (revision.y >= categories.y + categories.height - 1) {
		expect(line.content, 'wrapped revision divider').toBe('""');
		expect(line.height).toBe(1);
		expect(line.width).toBeCloseTo(header.width, 0);
		expect(revision.x + line.left).toBeCloseTo(header.x, 0);
		expect(line.top).toBe(0);
		expect(channels(line.color)[3] ?? 1).toBeGreaterThan(0);
	} else expect(line.content).toBe('none');
}

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
		'Layouts',
		'Components',
		'Models',
		'Services',
		'Helpers',
		'Types',
		'Configs',
		'Styles',
		'Dependencies'
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
export async function dependencyTables(component: Locator, page: Page, width: number) {
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
