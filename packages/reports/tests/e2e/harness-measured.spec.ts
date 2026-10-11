import { expect, test, type Page } from '@playwright/test';
import { seeded } from './support/harnessHistory';

const { commits } = seeded();
const at = (commit: string, rest: string) =>
	`/harness/branch/feature/kept%231/commit/${commit}/${rest}`;
const budgets = (page: Page) =>
	page
		.getByRole('region', { name: 'Component details' })
		.getByRole('group', { name: 'Budgets and measurements' });
const uncounted = 'Decision points are not counted in Rust: crates/counter/src/lib.rs.';

test('complexity that was not counted reads as unavailable and not frozen, beside a counted control', async ({
	page
}) => {
	await page.goto(at(commits.measured, 'map/unit/kernel.counter'));
	const native = budgets(page).getByRole('listitem');
	await expect(native.filter({ hasText: 'complexity:' })).toHaveText(
		new RegExp(`complexity: unavailable: ${uncounted.replaceAll('.', '\\.')}\\s*· not frozen`)
	);
	// Nothing claims a number for it, and what was measured keeps its limit.
	await expect(native.filter({ hasText: 'complexity:' })).not.toContainText('0 points');
	await expect(native.filter({ hasText: 'source-bytes:' })).toContainText(/\d+ bytes\s*· frozen/);
	// Its dependencies were not read either: neither its Rust nor what its manifest declares.
	await expect(native.filter({ hasText: 'dependencies:' })).toHaveText(
		/dependencies: unavailable: References are not read in Rust: crates\/counter\/src\/lib\.rs\. Packages declared in crates\/counter\/Cargo\.toml are not counted\.\s*· not frozen/
	);

	// Counted and uncounted code in one unit: the counted points are held by a limit, and the
	// value says what it leaves out.
	await page.goto(at(commits.measured, 'map/unit/kernel.mixed'));
	const mixed = budgets(page).getByRole('listitem').filter({ hasText: 'complexity:' });
	await expect(mixed).toContainText(/complexity: 3 points\s*· frozen at 3/);
	await expect(mixed).toContainText(
		'Partial: Counted in 1 of 2 code files. Decision points are not counted in Rust: crates/mixed/src/lib.rs.'
	);
	const referred = budgets(page).getByRole('listitem').filter({ hasText: 'dependencies:' });
	await expect(referred).toContainText(/dependencies: 0 count\s*· frozen at 0/);
	await expect(referred).toContainText(
		'Partial: References are not read in Rust: crates/mixed/src/lib.rs.'
	);

	// A counted unit at the commit that changed and measured it: a number, held by its limit.
	await page.goto(`/harness/branch/main/commit/${commits.shout}/map/unit/function.slugify`);
	const counted = budgets(page).getByRole('listitem').filter({ hasText: 'complexity:' });
	await expect(counted).toHaveText(/complexity: 1 points\s*· frozen at 1/);
	await expect(counted).not.toContainText('unavailable');
});

test('the growth of such a unit shows no complexity and says why, also on a phone', async ({
	page
}) => {
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(at(commits.measured, 'growth/unit/kernel.counter'));
		const rows = page.getByRole('table', { name: 'Growth of kernel.counter' }).locator('tbody tr');
		await expect(rows.first()).toBeVisible();
		for (const row of await rows.all()) {
			const complexity = row.locator('td').nth(2);
			await expect(complexity).toContainText('unavailable');
			await expect(complexity).toContainText(uncounted);
			await expect(row.locator('td').nth(1)).toContainText(/^\s*\d+/);
		}
		const sideways = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect([width, sideways]).toEqual([width, 0]);
	}
});
