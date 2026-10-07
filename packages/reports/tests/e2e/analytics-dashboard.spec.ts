import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
test.beforeAll(() => {
	execFileSync('bun', ['db/seed-data/analytics-e2e.ts']);
});
async function capture(page: import('@playwright/test').Page, name: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	if (await page.getByRole('heading', { name: 'Live CPU usage', exact: true }).count()) {
		await page.waitForFunction(() => !document.body.textContent?.includes('Sampling CPU'));
	}
	await mkdir('/tmp/harness-analytics-dashboard', { recursive: true });
	await page.screenshot({
		path: `/tmp/harness-analytics-dashboard/${name}-${process.env.SCREENSHOT_LABEL ?? 'test'}.png`,
		fullPage: true
	});
	if (name === 'mobile' && (await page.locator('[data-harness-component="analytics-cpu"]').count()))
		await page.locator('[data-harness-component="analytics-cpu"]').screenshot({
			path: `/tmp/harness-analytics-dashboard/mobile-cpu-${process.env.SCREENSHOT_LABEL ?? 'test'}.png`
		});
}
test('history shows known first-try rates, model attribution and working filters', async ({
	page
}) => {
	await page.goto('/analytics');
	await capture(page, 'history');
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toBeVisible();
	await expect(page.getByTestId('response-first-try')).toContainText('50%');
	await expect(page.getByTestId('clean-code-first-try')).toContainText('100%');
	await expect(page.getByText('fixture-author').first()).toBeVisible();
	await expect(page.getByText('fixture-evaluator').first()).toBeVisible();
	await expect(page.locator('a[href="/reports/fixture-report"]').first()).toBeVisible();
	await page.getByLabel('Model', { exact: true }).fill('absent-model');
	await page.getByRole('button', { name: 'Apply filters' }).click();
	await expect(page).toHaveURL(/model=absent-model/);
	await expect(page.getByTestId('response-first-try')).toContainText('No assessments');
	await page.getByRole('link', { name: 'Reset filters' }).click();
	await expect(page.getByTestId('response-first-try')).toContainText('50%');
	await page.getByRole('link', { name: 'Project reports', exact: true }).click();
	await page.getByRole('link', { name: 'Harness Analytics', exact: true }).click();
	await expect(page).toHaveURL(/analytics/);
});
test('live CPU shows host, Codex, Harness and agents and refreshes', async ({ page }) => {
	let samples = 0;
	await page.route('**/api/analytics-cpu', (route) => {
		samples++;
		return route.fulfill({
			json: {
				status: 'available',
				sampledAt: '2026-10-07T13:10:00Z',
				intervalMs: 1000,
				logicalCores: 8,
				machinePercent: 25,
				trackedPercent: 10,
				groups: [
					{ id: 'codex', label: 'Codex app', corePercent: 40, machinePercent: 5, processes: 3 },
					{ id: 'harness', label: 'Harness', corePercent: 16, machinePercent: 2, processes: 2 },
					{ id: 'agents', label: 'Local agents', corePercent: 24, machinePercent: 3, processes: 1 }
				],
				agents: [{ pid: 42, label: 'Claude', corePercent: 24, machinePercent: 3, processes: 1 }]
			}
		});
	});
	await page.goto('/analytics');
	// The missing heading fails here on the old page; the before image still captures that exact state.
	await capture(page, 'cpu');
	await expect(page.getByRole('heading', { name: 'Live CPU usage', exact: true })).toBeVisible();
	await expect(page.getByTestId('cpu-machine')).toContainText('25.0%');
	await expect(page.getByTestId('cpu-codex')).toContainText('5.0%');
	await expect(page.getByTestId('cpu-harness')).toContainText('2.0%');
	await expect(page.getByRole('cell', { name: 'Claude', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Refresh CPU' }).click();
	await expect.poll(() => samples).toBeGreaterThan(1);
	await page.unroute('**/api/analytics-cpu');
	await page.route('**/api/analytics-cpu', (route) =>
		route.fulfill({ status: 503, json: { status: 'unavailable' } })
	);
	await page.getByRole('button', { name: 'Refresh CPU' }).click();
	await expect(page.getByText('CPU usage unavailable', { exact: true })).toBeVisible();
	await expect(page.getByTestId('cpu-machine')).toHaveCount(0);
});
test('dashboard fits a narrow mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/analytics');
	await capture(page, 'mobile');
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toBeVisible();
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

test('reports hub navigation fits mobile and reaches analytics', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await mkdir('/tmp/harness-analytics-dashboard', { recursive: true });
		await page.locator('.topbar').screenshot({
			path: `/tmp/harness-analytics-dashboard/hub-mobile-${process.env.SCREENSHOT_LABEL ?? 'test'}.png`
		});
	}
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await page.getByRole('link', { name: 'Harness Analytics', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Harness Analytics', exact: true })).toBeVisible();
});

test('desktop dashboard shows the overview and live CPU together', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1550 });
	await page.goto('/analytics');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (await page.getByRole('heading', { name: 'Live CPU usage', exact: true }).count())
		await page.waitForFunction(() => !document.body.textContent?.includes('Sampling CPU'));
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await mkdir('/tmp/harness-analytics-dashboard', { recursive: true });
		const phase = process.env.SCREENSHOT_LABEL ?? 'test';
		await page.screenshot({ path: `/tmp/harness-analytics-dashboard/desktop-${phase}.png` });
		await page
			.locator('[data-harness-component="analytics-models"]')
			.screenshot({ path: `/tmp/harness-analytics-dashboard/models-${phase}.png` });
	}
	await expect(page.getByTestId('cpu-machine')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
