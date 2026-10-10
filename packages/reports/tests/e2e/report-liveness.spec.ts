import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';

const home = '/tmp/project-reports-e2e';

test('a report recorded as running keeps that outcome when it has gone quiet', async ({ page }) => {
	const store = new ReportRepository(home);
	const run = await store.begin({
		project: '/tmp/alpha-checkout',
		title: 'Unfinished exploration',
		mode: 'feature',
		environment: 'local fixture'
	});
	// As an old record reads: begun days ago, never finalized, never updated since.
	const manifest = join(home, 'runs', run.id, 'manifest.json');
	const recorded = {
		...run,
		startedAt: '2026-10-01T09:00:00.000Z',
		updatedAt: '2026-10-01T09:30:00.000Z'
	};
	await writeFile(manifest, JSON.stringify(recorded));
	const stored = await readFile(manifest, 'utf8');

	await page.goto('/harness/reports');
	const card = page.locator('.run-card').filter({ hasText: 'Unfinished exploration' });
	await expect(card.locator('.badge')).toHaveText(/Running/);
	await expect(card.locator('.badge')).not.toHaveText(/Interrupted/);
	await expect(card).toContainText('Recorded as running; no update since 1 Oct 2026');
	// It is still found as one that stopped updating, and as one that was recorded running.
	await page.getByRole('combobox', { name: 'Status' }).selectOption('interrupted');
	await expect(card).toBeVisible();
	await page.getByRole('combobox', { name: 'Status' }).selectOption('running');
	await expect(card).toBeVisible();
	await page.getByRole('combobox', { name: 'Status' }).selectOption('passed');
	await expect(card).toHaveCount(0);

	await page.goto(`/harness/reports/${run.id}`);
	await expect(page.locator('.badge').first()).toHaveText(/Running/);
	await expect(
		page.getByText('No updates for over 15 minutes. Completion is not proven.')
	).toBeVisible();
	expect(await readFile(manifest, 'utf8')).toBe(stored);
});
