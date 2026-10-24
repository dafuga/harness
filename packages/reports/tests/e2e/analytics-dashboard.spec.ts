import type { Sample } from './analytics-dashboard.spec.types';
import { expect, test } from '../../../../test/support/browserTest';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { analytics, type Assessments, type Models } from './support/analyticsCli';
import { sites } from './support/fixtures';
import { expectRetired } from './support/portableReport';
import { categories as expectedCategories } from './support/explorer';

test.beforeAll(() => {
	execFileSync('bun', ['db/seed-data/analytics-e2e.ts']);
});
/**
 * The analytics dashboard is gone. Its figures are still answered by the analytics command line
 * and the live CPU sample by the API; the addresses of the dashboard lead into the explorer.
 */
async function capture(page: import('@playwright/test').Page, name: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await mkdir('/tmp/harness-analytics-dashboard', { recursive: true });
	await page.screenshot({
		path: `/tmp/harness-analytics-dashboard/${name}-${process.env.SCREENSHOT_LABEL ?? 'test'}.png`,
		fullPage: true
	});
}

test('history has known first-try rates, model attribution and working filters', async ({
	page
}) => {
	await expectRetired(page, '/analytics');
	await capture(page, 'history');
	const { models } = analytics<Models>('models', '--site', sites.own);
	const author = models.firstTryByAuthor['fixture-author'];
	expect(author.response.firstTry.rate).toBe(0.5);
	expect(author.cleanCode.firstTry.rate).toBe(1);
	expect(Object.keys(models.authors)).toContain('fixture-author');
	expect(Object.keys(models.evaluators)).toContain('fixture-evaluator');
	// The task that passed first is still tied to the report that recorded it.
	expect(author.response.tasks.find((task) => task.report)?.report).toBe('fixture-report');
	// A filter that matches nothing leaves no assessment, and no rate is invented for it.
	const none = analytics<{ jev: Assessments }>('jev', '--model', 'absent-model').jev;
	expect(none.response.checks).toBe(0);
	expect(none.response.firstTry.rate).toBeNull();
	// The address that carried the filter leads into the explorer like any other.
	await expectRetired(page, '/analytics?model=absent-model');
});

test('the live CPU sample names host, Codex, Harness and agents and is taken anew each time', async ({
	request
}) => {
	const sample = async () => (await (await request.get('/api/analytics-cpu')).json()) as Sample;
	const first = await sample();
	expect(first.status).toBe('available');
	expect(first.groups.map((group) => group.id)).toEqual(['codex', 'harness', 'agents']);
	for (const group of first.groups) {
		expect(group.machinePercent).toBeGreaterThanOrEqual(0);
		expect(group.processes).toBeGreaterThanOrEqual(0);
	}
	expect(Array.isArray(first.agents)).toBe(true);
	// A second request is a second sample, not the first one kept.
	const second = await sample();
	expect(Date.parse(second.sampledAt)).toBeGreaterThan(Date.parse(first.sampledAt));
	// The command line takes the same sample, in the same shape.
	const local = analytics<Sample>('cpu');
	expect(local.groups.map((group) => group.id)).toEqual(['codex', 'harness', 'agents']);
});

test('the page the dashboard address leads to fits a narrow mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await expectRetired(page, '/analytics');
	await capture(page, 'mobile');
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toHaveCount(
		0
	);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('local CPU API returns the real server process sample', async ({ request }) => {
	const response = await request.get('/api/analytics-cpu');
	expect(response.status()).toBe(200);
	expect(response.headers()['cache-control']).toBe('no-store');
	const sample = await response.json();
	expect(sample.status).toBe('available');
	expect(sample.machinePercent).toBeGreaterThanOrEqual(0);
	expect(sample.machinePercent).toBeLessThanOrEqual(100);
	expect(sample.groups.find((g: { id: string }) => g.id === 'harness').processes).toBeGreaterThan(
		0
	);
});

test('the root fits mobile, shows the Harness navigation and offers no way to analytics', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await expectRetired(page, '/');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	const categories = page.getByRole('navigation', { name: 'Harness categories' });
	await expect(categories.locator('a, button')).toHaveText(expectedCategories);
	await expect(page.getByRole('link', { name: 'Harness Analytics', exact: true })).toHaveCount(0);
	// The categories are reachable on a phone: one press goes to another collection.
	await categories.getByRole('link', { name: 'Modules', exact: true }).click();
	await page
		.getByRole('tablist', { name: 'Module categories' })
		.getByRole('tab', { name: 'Helpers', exact: true })
		.click();
	await expect(page).toHaveURL(/\/functions$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Helpers' })).toBeVisible();
});

test('the page the dashboard address leads to fits a desktop and shows no CPU panel', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 1550 });
	await expectRetired(page, '/harness/analytics');
	await capture(page, 'desktop');
	await expect(page.getByTestId('cpu-machine')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Live CPU usage', exact: true })).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
