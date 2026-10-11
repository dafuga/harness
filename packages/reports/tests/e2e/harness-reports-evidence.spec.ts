import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { gatherCaptures } from '../../../../src/utils/gatherCaptures';
import { scenarioCoverage } from '../../../../src/utils/scenarioCoverage';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReportExportService } from '../../src/services/ReportExportService';
import { audioPairFixture } from '../../test/audioPairFixture';
import {
	captureAudio,
	captureScreen,
	evidenceOf,
	revision,
	servedBuild,
	viewports,
	type Viewport
} from './support/harnessCapture';
import { fixtures } from './support/fixtures';

const port = Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT || 5592);
test.use({ baseURL: `http://127.0.0.1:${port}` });
test.describe.configure({ mode: 'serial' });

const root = fixtures.reports;
const evidence = evidenceOf('reports');
const fixture = readFileSync(`${root}/fixture-id`, 'utf8');
const made = { paired: '', exported: '' };
const reportPage = async (page: Page, id: string, title: string) => {
	await page.goto(`/harness/reports/${id}`);
	await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
};

/** Each state the scenario declares: how to reach it and what must be on screen before capture. */
const states: Record<string, (page: Page) => Promise<void>> = {
	async hub(page) {
		await page.goto('/harness/reports');
		await expect(page.getByRole('heading', { name: 'Project reports', exact: true })).toBeVisible();
		await expect(page.getByText('Account settings review').first()).toBeVisible();
	},
	report: (page) => reportPage(page, fixture, 'Account settings review'),
	async gallery(page) {
		await reportPage(page, fixture, 'Account settings review');
		await page.locator('.gallery-section').first().scrollIntoViewIfNeeded();
	},
	async viewer(page) {
		await reportPage(page, fixture, 'Account settings review');
		await page.getByRole('button', { name: 'Open Tall report page' }).click();
		await expect(page.getByRole('dialog', { name: 'Tall report page' })).toBeVisible();
	},
	async comparison(page) {
		await reportPage(page, fixture, 'Account settings review');
		await page.getByRole('button', { name: 'Open Settings after', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('button', { name: 'View before screenshot' })).toBeVisible();
	},
	async audio(page) {
		await reportPage(page, made.paired, 'Audio comparison review');
		const open = { name: 'Open audio comparison: Paired recording', exact: true };
		await page.getByRole('button', open).click();
		await expect(page.getByRole('dialog').locator('audio').first()).toBeVisible();
	},
	async analytics(page) {
		// Evidence holds no sample of this machine: the live CPU panel says it has none.
		await page.route('**/api/analytics-cpu', (route) =>
			route.fulfill({ status: 503, json: { status: 'unavailable' } })
		);
		await page.goto('/harness/analytics');
		await expect(
			page.getByRole('heading', { name: 'Harness Analytics', exact: true })
		).toBeVisible();
		await expect(page.getByTestId('response-first-try')).toContainText('50%');
		await expect(page.getByText('CPU usage unavailable', { exact: true })).toBeVisible();
		await page.unroute('**/api/analytics-cpu');
	},
	// The portable report the server exports, opened as the file a reader downloads.
	async exported(page) {
		await reportPage(page, made.exported, 'Exported settings review');
		// The link sits in the collapsed run details; its address is what matters here.
		const link = page.locator('a.button', { hasText: 'Portable gallery' });
		const href = await link.getAttribute('href');
		await page.setContent(await (await page.request.get(href ?? '')).text());
		await expect(page.getByRole('heading', { name: 'Exported settings review' })).toBeVisible();
	}
};

test.beforeAll(async () => {
	rmSync(evidence, { recursive: true, force: true });
	execFileSync('bun', ['db/seed-data/analytics-e2e.ts']);
	made.paired = (await audioPairFixture(root)).run.id;
	// A finished report of this site: only a finalized report has exports to download.
	const store = new ReportRepository(root);
	const input = { project: fixtures.site('alpha-project'), title: 'Exported settings review' };
	const run = await store.begin({ ...input, mode: 'feature', environment: 'local fixture' });
	const check = { id: 'save', title: 'Save settings', status: 'passed' as const };
	await store.record(run.id, { kind: 'check', data: check });
	const shown = { id: 'dialog', title: 'Captured dialog', category: 'Settings' };
	const screenshot = { ...shown, path: `${root}/fixture.png`, status: 'passed' as const };
	await store.record(run.id, { kind: 'evidence', data: screenshot });
	await new ReportExportService(store).finalize(run.id);
	made.exported = run.id;
});

for (const viewport of viewports) {
	test(`every report and analytics state is captured at the ${viewport.id} viewport`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const [state, reach] of Object.entries(states)) {
			await reach(page);
			await captureScreen(page, state, viewport as Viewport, evidence);
		}
	});
}

test('a paired recording plays in the report viewer and is captured as it was served', async ({
	page
}) => {
	await states.audio(page);
	const player = page.getByRole('dialog').locator('audio').first();
	expect(await captureAudio(page, 'audio', player, evidence)).toBeCloseTo(6, 0);
});

test('what was captured satisfies the reports scenario, served by the build under test', async ({
	page
}) => {
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(readFileSync('../../specification/scenarios/harness-reports.json', 'utf8'))
	);
	const { gathered, failures } = gatherCaptures(evidence, 'evidence');
	expect(failures).toEqual([]);
	expect(gathered).toHaveLength(Object.keys(states).length * viewports.length + 1);
	const served = await servedBuild(page);
	const builds = { declared: ['reports'], compiled: new Map([['reports', served?.buildId ?? '']]) };
	const judged = scenarioCoverage({
		scenario,
		commit: revision,
		gathered,
		checkFailed: false,
		builds
	});
	expect(judged.failures).toEqual([]);
	expect(judged.states.map((state) => [state.id, state.captures.length])).toEqual(
		Object.keys(states).map((state) => [state, state === 'audio' ? 4 : 3])
	);
});
