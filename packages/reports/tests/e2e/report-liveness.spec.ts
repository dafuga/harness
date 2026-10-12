import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { fixtures } from './support/fixtures';
import { expectRetired, reportView } from './support/portableReport';

const home = fixtures.reports;

test('a report recorded as running keeps that outcome when it has gone quiet', async ({ page }) => {
	const store = new ReportRepository(home);
	const run = await store.begin({
		project: fixtures.site('alpha-checkout'),
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

	// The hub that listed it is gone; what a client is told about it is the report API's answer.
	await expectRetired(page, '/harness/reports');
	const listed = await (await page.request.get('/api/reports')).json();
	const found = listed.find((report: { id: string }) => report.id === run.id);
	expect(found).toMatchObject({ status: 'running', state: 'active' });
	expect(found.updatedAt).toBe('2026-10-01T09:30:00.000Z');

	// The viewer says it was recorded as running and that completion is not proven.
	await expectRetired(page, `/harness/reports/${run.id}`);
	await page.goto(await reportView(run.id));
	await expect(page.locator('.badge').first()).toHaveText(/Running/);
	await expect(page.locator('.badge').first()).not.toHaveText(/Interrupted/);
	await expect(
		page.getByText('No updates for over 15 minutes. Completion is not proven.')
	).toBeVisible();
	// Neither being listed nor being viewed rewrote what was recorded.
	expect(await readFile(manifest, 'utf8')).toBe(stored);
});
