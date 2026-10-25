import { expect, test, type Locator } from '../../../../test/support/browserTest';
import { fits, pictured, screens, sharedField } from './support/sharedSelect';
import { box, channels, combo, reachable, styled } from './support/shellChecks';
import { exerciseNativeAtoms } from './support/nativeAtoms';
import { shellCategories as categories } from './support/shellData';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture,
	shellOrigin
} from './support/shellFixture';

/**
 * The pieces every explorer screen shares, each once on a page of their own: the icon set, the
 * binary badge, actions, tabs and the bar without an address, and beside them, outside the
 * explorer, two rows of the console that was.
 */
const here = `${shellOrigin}/`;
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['primitives']);
});
test.afterAll(() => removeShellFixture(home));

for (const [screen, width, height] of screens) {
	test(`the icons are one set and a verdict has two looks at ${screen} width`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await openShellPage(page, home, 'primitives');
		await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
		await pictured(page, `explorer-shell-pieces-${screen}`);
		const icons = page.getByRole('list', { name: 'Icons' }).locator('li svg');
		expect(await icons.count()).toBeGreaterThan(30);
		const sizes = await icons.evaluateAll((list) =>
			list.map((icon) => [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height])
		);
		expect(sizes.filter(([wide, high]) => wide !== 24 || high !== 24)).toEqual([]);

		// The title keeps its first wording; a verdict now has three looks: passes share one colour,
		// evidence not yet proven (missing or incomplete) a neutral one, and an actual failure red.
		const verdicts = page.getByLabel('Verdicts').locator('.hx-verdict');
		const colours = await verdicts.evaluateAll((list) =>
			list.map((badge) => getComputedStyle(badge.querySelector('svg')!).color)
		);
		const [passed, unproven, failed] = [colours[0], colours[1], colours[5]];
		expect(colours).toEqual([passed, unproven, passed, unproven, passed, failed, failed]);
		const [pass, open, fail] = [channels(passed), channels(unproven), channels(failed)];
		expect(pass[1], 'a pass is green').toBeGreaterThan(Math.max(pass[0], pass[2]));
		expect(fail[0], 'an actual failure is red').toBeGreaterThan(Math.max(fail[1], fail[2]) * 2);
		expect(Math.max(open[0], open[1]), 'unproven is neither red nor green').toBeLessThan(open[2]);
		expect(await styled(verdicts.nth(2).getByRole('button'), 'border-top-color')).toBe(passed);
		expect(await styled(verdicts.nth(3).getByRole('button'), 'border-top-color')).toBe(unproven);
		// Only the icon is drawn: the status is the name of the mark, and each has a tooltip of its own.
		expect((await page.getByLabel('Verdicts').innerText()).trim()).toBe('');
		await expect(page.getByRole('button', { name: 'Failed', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Evidence missing', exact: true })).toBeVisible();
		const tips = await page
			.locator('[role="tooltip"]')
			.evaluateAll((list) => list.map((tip) => tip.id));
		expect([tips.length, new Set(tips).size]).toEqual([9, 9]);

		// Without an address the bar still names its navigation and offers nothing to choose.
		const idle = page.getByRole('region', { name: 'Bar without an address' });
		await expect(idle.getByRole('navigation', { name: 'Harness categories' })).toHaveText(
			new RegExp(`^\\s*${categories.join('\\s*')}\\s*$`)
		);
		await expect(idle.getByRole('link')).toHaveText(['Harness']);
		await expect(idle.getByRole('combobox')).toHaveCount(0);
		// What a host puts under the bar without a column of its own starts where the column does.
		const loading = page.getByRole('status').filter({ hasText: 'Loading history' });
		const [edge, column] = [
			await box(loading),
			await box(page.getByRole('navigation', { name: 'Breadcrumb' }))
		];
		expect(edge.x).toBeGreaterThanOrEqual(16);
		expect(Math.abs(edge.x - column.x)).toBeLessThan(1);
		expect(edge.x + edge.width).toBeLessThanOrEqual(width - edge.x + 1);
		await captureShell(page, home, { state: 'pieces', viewport: screen });
		expect(await fits(page)).toBe(true);
	});

	test(`the tab that is shown stays whole in its strip, however it was chosen, at ${screen} width`, async ({
		page
	}) => {
		// Opened as wide as a desktop first: a strip that fits there is too narrow after a resize.
		await page.setViewportSize({ width: 1440, height: 900 });
		await openShellPage(page, home, 'primitives');
		const [strip, narrow] = ['Sections', 'Narrow sections'].map((name) =>
			page.getByRole('tablist', { name, exact: true })
		);
		/** Whether the tab that is shown lies wholly inside what its strip shows. */
		const whole = (tabs: Locator) =>
			tabs.getByRole('tab', { selected: true }).evaluate((tab) => {
				const [own, held] = [
					tab.getBoundingClientRect(),
					tab.parentElement!.getBoundingClientRect()
				];
				return own.left >= held.left - 0.5 && own.right <= held.right + 0.5;
			});
		// A strip narrower than its tabs scrolls, and opens with the tab that is shown in view.
		expect(await narrow.evaluate((tabs) => tabs.scrollWidth > tabs.clientWidth)).toBe(true);
		await expect(narrow.getByRole('tab', { selected: true })).toHaveText('History');
		await expect.poll(() => whole(narrow)).toBe(true);
		// Chosen from elsewhere on the page, without touching the strip, each end comes into view.
		for (const [action, shown] of [
			['Show contract', 'Contract'],
			['Show history', 'History']
		]) {
			await page.getByRole('button', { name: action }).click();
			await expect(narrow.getByRole('tab', { selected: true })).toHaveText(shown);
			await expect.poll(() => whole(narrow)).toBe(true);
		}
		// The keyboard still walks the strip tab by tab, and what it reaches is brought into view.
		await narrow.getByRole('tab', { name: 'History' }).focus();
		await page.keyboard.press('Shift+Tab');
		await expect(narrow.getByRole('tab', { name: 'Measurements' })).toBeFocused();
		// History of the wide strip is chosen on a wide screen; the screen then becomes this one.
		await page.getByRole('button', { name: 'Open history' }).click();
		await expect(strip.getByRole('tab', { selected: true })).toHaveText('History');
		await page.setViewportSize({ width, height });
		await expect.poll(() => whole(strip)).toBe(true);
		await expect.poll(() => whole(narrow)).toBe(true);
		await strip.scrollIntoViewIfNeeded();
		await pictured(page, `explorer-shell-tabs-${screen}`);
		await captureShell(page, home, { state: 'pieces-tabs', viewport: screen });
		expect(await fits(page)).toBe(true);
	});

	test(`actions and tabs are followed in the page, and the console that was keeps its look at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await openShellPage(page, home, 'primitives');
		const open = page.getByRole('link', { name: 'Open page' });
		await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
		for (const action of [open, page.getByRole('button', { name: 'Back to overview' })]) {
			await reachable(action, width);
			await action.click();
		}
		// A plain click on a link is given to the application; the page stays where it is.
		await expect(page.getByRole('status', { name: 'Pressed' })).toHaveText('2');
		await expect(page).toHaveURL(here);
		await expect(page.getByRole('button', { name: 'Go to tip' })).toBeDisabled();
		await exerciseNativeAtoms(page);

		const tabs = page.getByRole('tablist', { name: 'Sections', exact: true });
		const chosen = tabs.getByRole('tab', { selected: true });
		await expect(tabs.getByRole('tab')).toHaveText([
			'Contract',
			'Measurements',
			'Source',
			'History'
		]);
		await expect(chosen).toHaveText('Contract');
		for (const tab of await tabs.getByRole('tab').all())
			expect((await box(tab)).height).toBeGreaterThanOrEqual(44);
		// The tab that is shown has a line of its own colour under it; the others have none to see.
		expect(await styled(chosen, 'border-bottom-color')).toBe(await styled(chosen, 'color'));
		const rest = tabs.getByRole('tab', { name: 'History' });
		expect(channels(await styled(rest, 'border-bottom-color'))[3]).toBe(0);
		await expect(tabs.getByRole('tab', { name: 'Source' })).toBeDisabled();
		await tabs.getByRole('tab', { name: 'Measurements' }).click();
		await expect(page.getByRole('status', { name: 'Section' })).toHaveText('measurements');
		await expect(chosen).toHaveText('Measurements');
		await expect(page).toHaveURL(here);
		await page.getByRole('switch', { name: 'Changed only' }).check();
		await reachable(page.getByRole('searchbox'), width);

		// Explorer and workspace controls share one palette, including legacy alias consumers.
		const legacy = page.getByRole('region', { name: 'Legacy console rows' });
		const selected = legacy.getByRole('tab', { selected: true });
		const [outside, inside] = await page.evaluate(() =>
			[document.body, document.querySelector('.hx-shell')!].map((parent) => {
				const probe = parent.appendChild(document.createElement('i'));
				probe.style.color = 'var(--gold)';
				const colour = getComputedStyle(probe).color;
				probe.remove();
				return colour;
			})
		);
		expect(inside).toBe(outside);
		expect(inside).toBe('rgb(243, 195, 59)');
		await expect(selected).toHaveText('Component map');
		expect(await styled(selected, 'border-bottom-color')).toBe(outside);
		expect(await styled(chosen, 'color')).toBe(inside);
		expect(channels(await styled(combo(legacy, 'Commit'), 'color'))[3] ?? 1).toBe(1);
		await expect(legacy.getByText('Go to tip')).toHaveCount(0);
		for (const name of ['Branch', 'Commit']) await sharedField(combo(legacy, name));
		await captureShell(page, home, { state: 'pieces-used', viewport: screen });
		expect(await fits(page)).toBe(true);
	});
}
