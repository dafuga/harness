import { expect, test } from '@playwright/test';
import { fits, pictured, screens } from './support/sharedSelect';
import { box } from './support/shellChecks';
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture
} from './support/shellFixture';

/**
 * The verdict of the explorer, looked at alone: an icon that says nothing until it is pointed
 * at, focused or tapped, and a tooltip with its status and reasons that stays on the screen
 * whatever its place and however many reasons it holds.
 */
let home = '';

test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['primitives']);
});
test.afterAll(() => removeShellFixture(home));

for (const [screen, width, height] of screens) {
	test(`a verdict tells its status and reasons when pointed at, focused or tapped at ${screen} width`, async ({
		browser
	}) => {
		// A screen that is touched as well as pointed at, as a tablet or a phone is.
		const context = await browser.newContext({ hasTouch: true, viewport: { width, height } });
		const page = await context.newPage();
		await openShellPage(page, home, 'primitives');
		const [group, tooltip] = [page.getByLabel('Verdicts'), page.getByRole('tooltip')];
		const missing = group.getByRole('button', { name: 'Evidence missing' });
		await expect(tooltip).toHaveCount(0);
		// A pointer over the mark opens it, and may cross to the tooltip without losing it.
		await missing.hover();
		await expect(tooltip).toHaveText(/^Evidence missing\s*no capture at mobile$/);
		await expect(missing).toHaveAttribute('aria-expanded', 'true');
		await tooltip.hover();
		await expect(tooltip).toBeVisible();
		await page.mouse.move(1, 1);
		await expect(tooltip).toHaveCount(0);
		// The keyboard opens it by reaching the mark, and Escape closes it where it stands.
		await group.getByRole('button').first().focus();
		await page.keyboard.press('Tab');
		await expect(missing).toBeFocused();
		await expect(tooltip).toHaveText(/^Evidence missing/);
		await page.keyboard.press('Escape');
		await expect(tooltip).toHaveCount(0);
		await expect(missing).toBeFocused();
		// A tap opens it, a second tap closes it, and so does a tap anywhere else.
		await missing.tap();
		await expect(tooltip).toBeVisible();
		await missing.tap();
		await expect(tooltip).toHaveCount(0);
		await missing.tap();
		await expect(tooltip).toBeVisible();
		await page.getByRole('heading', { level: 2 }).tap();
		await expect(tooltip).toHaveCount(0);
		// At either edge of a narrow table it is whole on the screen, and no wrapper cuts it.
		for (const name of ['Stale evidence', 'Coverage incomplete']) {
			await page.getByRole('group', { name: 'Narrow table' }).getByRole('button', { name }).hover();
			await expect(tooltip).toContainText('belongs to another commit');
			const shown = await box(tooltip);
			expect([name, shown.x >= 0, shown.x + shown.width <= width]).toEqual([name, true, true]);
			expect([name, shown.y >= 0, shown.y + shown.height <= height]).toEqual([name, true, true]);
			const uncut = await tooltip.evaluate((tip) => {
				const place = tip.getBoundingClientRect();
				const corners = [place.left + 2, place.right - 2].map((x) =>
					document.elementFromPoint(x, place.top + place.height / 2)
				);
				return corners.every((found) => found !== null && tip.contains(found));
			});
			expect([name, uncut]).toEqual([name, true]);
			await page.mouse.move(1, 1);
		}
		// What is kept as evidence is the open tooltip of a verdict that did not pass.
		await missing.hover();
		await expect(tooltip).toBeVisible();
		await pictured(page, `explorer-shell-verdict-${screen}`);
		await captureShell(page, home, { state: 'pieces-verdict', viewport: screen });
		expect(await fits(page)).toBe(true);
		await context.close();
	});

	test(`more reasons than a short screen has room for are read inside the tooltip at ${screen} width`, async ({
		page
	}) => {
		// A screen as low as a phone held sideways: no side of the mark has room for forty lines.
		const low = 360;
		await page.setViewportSize({ width, height: low });
		await openShellPage(page, home, 'primitives');
		const [group, tooltip] = [page.getByLabel('Verdicts'), page.getByRole('tooltip')];
		const many = group.getByRole('button', { name: 'Many reasons' });
		await group.getByRole('button', { name: 'Failed', exact: true }).focus();
		await page.keyboard.press('Tab');
		await expect(many).toBeFocused();
		// Every reason is in it, none is cut away, and the tooltip itself is whole on the screen.
		await expect(tooltip.locator('span')).toHaveCount(40);
		const shown = await box(tooltip);
		expect([shown.y >= 0, shown.y + shown.height <= low]).toEqual([true, true]);
		expect([shown.x >= 0, shown.x + shown.width <= width]).toEqual([true, true]);
		const last = tooltip.locator('span').last();
		const reads = () =>
			tooltip.evaluate((tip) => {
				const [own, end] = [
					tip.getBoundingClientRect(),
					tip.lastElementChild!.getBoundingClientRect()
				];
				return { scrolls: tip.scrollHeight > tip.clientHeight, end: end.bottom <= own.bottom + 1 };
			});
		expect(await reads()).toEqual({ scrolls: true, end: false });
		// The keyboard that opened it reads on: the keys that scroll a page scroll the tooltip.
		await page.keyboard.press('PageDown');
		await page.keyboard.press('End');
		await expect.poll(async () => (await reads()).end).toBe(true);
		await expect(last).toHaveText(/^reason 40:/);
		await pictured(page, `explorer-shell-verdict-long-${screen}`);
		await page.keyboard.press('Home');
		await expect.poll(() => tooltip.evaluate((tip) => tip.scrollTop)).toBe(0);
		// A pointer reads it the same way, and Escape still closes it.
		await many.hover();
		await tooltip.hover();
		await page.mouse.wheel(0, 4000);
		await expect.poll(async () => (await reads()).end).toBe(true);
		await many.focus();
		await page.keyboard.press('Escape');
		await page.mouse.move(1, 1);
		await expect(tooltip).toHaveCount(0);
		expect(await fits(page)).toBe(true);
	});
}
