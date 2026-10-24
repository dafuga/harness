import { expect, type Locator, type Page } from '@playwright/test';
import { captureShell, shellOrigin } from './shellFixture';
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

/** Primary Modules opens the scoped module strip without widening the page. */
export async function moduleNavigation(
	page: Page,
	home: string,
	screen: string,
	scoped: string
): Promise<void> {
	const bar = page.getByRole('banner');
	await expect(bar).toHaveAttribute('data-harness-component', 'harness-harness-navbar');
	await bar.getByRole('link', { name: 'Modules', exact: true }).click();
	const modules = bar.getByRole('tablist', { name: 'Module categories' });
	await pictured(page, `explorer-shell-modules-${screen}`);
	await captureShell(page, home, { state: 'modules', viewport: screen });
	await expect(modules.getByRole('tab')).toHaveText([
		'Layouts',
		'Components',
		'Models',
		'Services',
		'Helpers',
		'Types'
	]);
	await modules.getByRole('tab', { name: 'Types', exact: true }).click();
	await pictured(page, `explorer-shell-types-${screen}`);
	await captureShell(page, home, { state: 'types', viewport: screen });
	expect(await fits(page), 'module tabs scroll without widening the page').toBe(true);
	await expect(page).toHaveURL(`${shellOrigin}${scoped}/types`);
	await expect(bar.getByRole('link', { name: 'Modules', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await modules.getByRole('tab', { name: 'Helpers', exact: true }).click();
	await expect(page).toHaveURL(`${shellOrigin}${scoped}/functions`);
}
