import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { fits, pictured, screens, sharedField, typed } from './support/sharedSelect';
import {
	box,
	channels,
	combo,
	compactRevision,
	reachable,
	navigationSpacing,
	styled,
	revisionDivider
} from './support/shellChecks';
import { sha, shellBranch, shellMount, longBranch } from './support/shellData';
import { shellCategories as categories } from './support/shellData';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture,
	shellOrigin
} from './support/shellFixture';
const scoped = `${shellMount}/branch/feature%2Fshell%231`;
const earlier = `${scoped}/commit/${sha(3)}`;
const at = (path: string) => `${shellOrigin}${path}`;
/** The line under a category: how thick it is and what colour; nothing when there is none. */
const underline = (locator: Locator) =>
	locator.evaluate((element) => {
		const style = getComputedStyle(element, '::after');
		return style.content === 'none' ? null : [parseFloat(style.height), style.backgroundColor];
	});
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['navbar']);
});
test.afterAll(() => removeShellFixture(home));

/** Opens the bar over the made-up history and waits for the name both headers show. */
async function opened(page: Page, width: number, height: number): Promise<Locator> {
	await page.setViewportSize({ width, height });
	await openShellPage(page, home, 'navbar');
	await expect(page.getByText('Harness', { exact: true }).first()).toBeVisible();
	return page.getByRole('banner');
}
/** Chooses an earlier commit, then opens Helpers there with the keyboard. */
async function earlierFunctions(page: Page, bar: Locator): Promise<Locator> {
	const functions = bar.getByRole('tab', { name: 'Helpers', exact: true });
	await expect(combo(bar, 'Commit')).toBeVisible();
	await combo(bar, 'Commit').selectOption(sha(3));
	await expect(page).toHaveURL(at(`${earlier}/pages`));
	await bar.getByRole('link', { name: 'Modules', exact: true }).click();
	await functions.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(at(`${earlier}/functions`));
	return functions;
}

for (const [screen, width, height] of screens) {
	test(`the bar shows its navigation with an icon above each label at ${screen} width`, async ({
		page
	}) => {
		const bar = await opened(page, width, height);
		await pictured(page, `explorer-shell-bar-${screen}`);
		await captureShell(page, home, { state: 'current', viewport: screen });
		await navigationSpacing(bar);
		const links = bar.getByRole('navigation', { name: 'Harness categories' }).getByRole('link');
		await expect(links).toHaveText(categories);
		await expect(page.getByRole('link', { name: /Reports|Analytics|Activity|Growth/ })).toHaveCount(
			0
		);
		await expect(page.getByRole('tab')).toHaveCount(0);
		for (const link of await links.all()) {
			const [icon, label] = [await box(link.locator('svg')), await box(link.locator('span'))];
			expect(icon.y + icon.height, 'the icon is above its label').toBeLessThanOrEqual(label.y);
			const centres = [icon.x + icon.width / 2, label.x + label.width / 2];
			expect(Math.abs(centres[0] - centres[1]), 'and centred over it').toBeLessThan(1.5);
			await reachable(link, width);
		}
		// Only the category that is shown stands out: its own colour, and a line of it underneath.
		await expect(links.nth(0)).toHaveAttribute('aria-current', 'page');
		const colours = await Promise.all((await links.all()).map((link) => styled(link, 'color')));
		expect(new Set(colours.slice(1)).size).toBe(1);
		expect(colours[0]).not.toBe(colours[1]);
		const line = await underline(links.nth(0));
		expect(line?.[0]).toBeGreaterThanOrEqual(2);
		expect(line?.[1]).toBe(colours[0]);
		for (const other of (await links.all()).slice(1)) {
			await expect(other).not.toHaveAttribute('aria-current', 'page');
			expect(await underline(other)).toBeNull();
		}
		const brand = bar.getByRole('link', { name: 'Harness', exact: true });
		await expect(brand).toHaveAttribute('href', `${scoped}/pages`);
		await reachable(brand, width);
		await expect(bar.getByText('synthetic-repository', { exact: true })).toBeVisible();

		// The keyboard walks the bar in reading order, and shows where it is.
		await brand.focus();
		for (const name of categories) {
			await page.keyboard.press('Tab');
			await expect(links.filter({ hasText: name })).toBeFocused();
			expect(await styled(links.filter({ hasText: name }), 'outline-style')).not.toBe('none');
		}
		for (const name of ['Branch', 'Commit']) {
			await page.keyboard.press('Tab');
			await expect(combo(bar, name)).toBeFocused();
		}
		// The bar spans the screen whatever frame the root also names, and the title under it keeps
		// the size of the explorer: no rule of the console that was reaches inside.
		const [span, title, earlier] = [
			await box(bar),
			page.getByRole('heading', { name: 'Title in the explorer' }),
			page.getByRole('heading', { name: 'Title in the earlier frame' })
		];
		expect([span.x, span.width]).toEqual([0, width]);
		expect(parseFloat(await styled(title, 'font-size'))).toBeGreaterThan(
			parseFloat(await styled(earlier, 'font-size'))
		);
		if (screen === 'desktop') {
			// On a wide screen the brand, the categories and both fields are one row.
			const [row, first] = [await box(bar), await box(links.nth(0))];
			expect(row.height).toBeLessThanOrEqual(first.height + 18);
			expect((await box(brand)).x).toBeLessThan(first.x);
			expect(first.x).toBeLessThan((await box(combo(bar, 'Branch'))).x);
		}
		expect(await fits(page)).toBe(true);
		await links.filter({ hasText: 'Styles' }).click();
		await expect(page).toHaveURL(at(`${scoped}/styles`));
		await links.filter({ hasText: 'Platforms' }).click();
		await expect(page).toHaveURL(at(`${scoped}/platforms`));
		await links.filter({ hasText: 'Modules' }).click();
		const modules = bar.getByRole('tablist', { name: 'Module categories' });
		await pictured(page, `explorer-shell-modules-${screen}`);
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
		await expect(page).toHaveURL(at(`${scoped}/types`));
		await expect(links.filter({ hasText: 'Modules' })).toHaveAttribute('aria-current', 'page');
		await modules.getByRole('tab', { name: 'Helpers', exact: true }).click();
		await expect(page).toHaveURL(at(`${scoped}/functions`));
	});
	test(`the branch with its tip and the viewed commit are told apart at ${screen} width`, async ({
		page
	}) => {
		const bar = await opened(page, width, height);
		const [branch, commit] = [combo(bar, 'Branch'), combo(bar, 'Commit')];
		const tip = bar.getByRole('button', { name: 'Go to tip' });
		await pictured(page, `explorer-shell-current-${screen}`);
		await revisionDivider(bar);
		await compactRevision(bar);
		await expect(branch).toHaveValue(shellBranch);
		await expect(commit).toHaveValue(sha(5));
		for (const field of [branch, commit]) {
			await sharedField(field);
			await reachable(field, width);
		}
		await expect(branch).toHaveAttribute('title', /Tip · 0505050/);
		await expect(commit).toHaveAttribute('title', /Current · branch tip/);
		await expect(bar.locator('small').first()).not.toBeVisible();
		await expect(tip).toBeDisabled();
		await reachable(tip, width);

		const functions = await earlierFunctions(page, bar);
		await expect(commit).toHaveAttribute('title', /Historical commit/);
		await expect(branch).toHaveAttribute('title', /Tip · 0505050/);
		await expect(functions).toHaveAttribute('aria-selected', 'true');
		await expect(bar.getByRole('link', { name: 'Pages' })).toHaveAttribute(
			'href',
			`${earlier}/pages`
		);
		const short = bar.getByText('0303030', { exact: true });
		await expect(short).toBeVisible();
		expect(channels(await styled(commit, 'color'))[3], 'the field paints no second text').toBe(0);
		const [shown, field] = [await box(short), await box(commit)];
		expect(shown.x).toBeGreaterThan(field.x);
		expect(shown.x + shown.width).toBeLessThan(field.x + field.width - 30);
		expect(Math.abs(shown.y + shown.height / 2 - field.y - field.height / 2)).toBeLessThan(2);
		await expect(commit.locator('option:checked')).toHaveText(/^0303030 Record page evidence/);
		await pictured(page, `explorer-shell-historical-${screen}`);
		await captureShell(page, home, { state: 'historical', viewport: screen });
		await branch.selectOption(longBranch);
		await expect(branch).toHaveValue(longBranch);
		await expect(branch).toHaveAttribute('title', new RegExp(longBranch));
		await expect(branch.locator('..').locator('.report-select-value')).toHaveText('featur…h-name');
		await compactRevision(bar);
		expect(await fits(page)).toBe(true);
	});

	test(`Go to tip, back, a reload and another branch each keep their place at ${screen} width`, async ({
		page
	}) => {
		const bar = await opened(page, width, height);
		const [branch, commit] = [combo(bar, 'Branch'), combo(bar, 'Commit')];
		await pictured(page, `explorer-shell-return-${screen}`);
		const functions = await earlierFunctions(page, bar);
		// Go to tip is the same place on the current branch.
		const back = bar.getByRole('link', { name: 'Go to tip' });
		await expect(back).toHaveAttribute('href', `${scoped}/functions`);
		await reachable(back, width);
		await back.click();
		await expect(page).toHaveURL(at(`${scoped}/functions`));
		await expect(commit).toHaveAttribute('title', /Current · branch tip/);
		await expect(bar.getByRole('button', { name: 'Go to tip' })).toBeDisabled();
		await expect(commit).toHaveValue(sha(5));

		// Back, a reload and forward each show the scope their address names.
		await page.goBack();
		await expect(page).toHaveURL(at(`${earlier}/functions`));
		await expect(commit).toHaveAttribute('title', /Historical commit/);
		await expect(commit).toHaveValue(sha(3));
		await page.reload();
		await expect(commit).toHaveValue(sha(3));
		await expect(functions).toHaveAttribute('aria-selected', 'true');
		await page.goForward();
		await expect(page).toHaveURL(at(`${scoped}/functions`));
		await expect(commit).toHaveValue(sha(5));

		// Another branch, chosen from the keyboard, stays current on the same category.
		await typed(page, branch, 'm');
		await expect(page).toHaveURL(at(`${shellMount}/branch/main/functions`));
		await expect(branch).toBeFocused();
		await expect(branch).toHaveAttribute('title', /Tip · 0303030/);
		await expect(commit).toHaveAttribute('title', /Current · branch tip/);
		await expect(commit).toHaveValue(sha(3));
		await captureShell(page, home, { state: 'returned', viewport: screen });
		expect(await fits(page)).toBe(true);
	});
}
