import { expect, test, type Page } from '../../../../test/support/browserTest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { gatherCaptures } from '../../../../src/services/check-run-service/gatherCaptures';
import { scenarioCoverage } from '../../../../src/services/verification-service/scenarioCoverage';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { ReportExportService } from '../../src/services/report-export-service/ReportExportService';
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
import { servedReport } from './support/portableReport';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';

/**
 * The evidence of what is left of the reports of a site. The hub, the report page and the
 * analytics dashboard are gone: their addresses are captured where they lead now. A report is
 * shown by the page its export builds, which the server under test serves, and its recordings
 * are played from the bytes that server serves.
 */
const port = Number(process.env.HARNESS_CONSOLE_E2E_EXPOSED_PORT || 5592);
const origin = `http://127.0.0.1:${port}`;
test.use({ baseURL: origin });
test.describe.configure({ mode: 'serial' });

const root = fixtures.reports;
const evidence = join(evidenceOf('reports'), 'reports-captures');
const title = 'Exported settings review';
const made = { paired: '', exported: '' };

/** An address of a removed screen, followed to the page of the explorer it leads to. */
async function retired(page: Page, address: string) {
	await page.goto(address);
	await expect(page).toHaveURL(/\/harness\/branch\/[^/]+\/(commit\/[0-9a-f]{40}\/)?pages$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
}

/** The page the export of the finished report built, as the server under test serves it. */
async function exported(page: Page) {
	const served = await page.request.get(`/api/reports/${made.exported}/exports/index.html`);
	expect(served.status()).toBe(200);
	await page.setContent(await served.text());
	await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

/** Each state the scenario declares: how to reach it and what must be on screen before capture. */
const states: Record<string, (page: Page) => Promise<void>> = {
	'retired-hub': (page) => retired(page, '/harness/reports'),
	'retired-report': (page) => retired(page, `/harness/reports/${made.exported}`),
	'retired-analytics': (page) => retired(page, '/harness/analytics'),
	exported,
	async 'image-gallery'(page) {
		await exported(page);
		await page.locator('.gallery-section').first().scrollIntoViewIfNeeded();
		await expect(
			page.getByRole('button', { name: 'Open Tall report page', exact: true })
		).toBeVisible();
	},
	async gallery(page) {
		await page.goto(await servedReport(made.paired, origin));
		await page.locator('.gallery-section').first().scrollIntoViewIfNeeded();
		await expect(
			page.getByRole('button', { name: 'Open audio comparison: Paired recording', exact: true })
		).toBeVisible();
	},
	async viewer(page) {
		await exported(page);
		await page.getByRole('button', { name: 'Open Tall report page' }).click();
		await expect(page.getByRole('dialog', { name: 'Tall report page' })).toBeVisible();
	},
	async comparison(page) {
		await exported(page);
		await page.getByRole('button', { name: 'Open Settings after', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('button', { name: 'View before screenshot' })).toBeVisible();
	},
	// The recordings are read from the report API of the server, so what is played is what it serves.
	async audio(page) {
		await page.goto(await servedReport(made.paired, origin));
		const open = { name: 'Open audio comparison: Paired recording', exact: true };
		await page.getByRole('button', open).click();
		await expect(page.getByRole('dialog').locator('audio').first()).toBeVisible();
	}
};

/** A finished report of this site with a tall capture and a before and after at every size. */
async function finished(): Promise<string> {
	const store = new ReportRepository(root);
	const input = { project: fixtures.site('alpha-project'), title };
	const run = await store.begin({ ...input, mode: 'feature', environment: 'local fixture' });
	const check = { id: 'save', title: 'Save settings', status: 'passed' as const };
	await store.record(run.id, { kind: 'check', data: check });
	const shown = { status: 'passed' as const, path: join(root, 'fixture.png') };
	const tall = { id: 'tall', title: 'Tall report page', category: 'Details' };
	await store.record(run.id, {
		kind: 'evidence',
		data: { ...tall, ...shown, path: join(root, 'tall.png'), viewport: '1440px desktop' }
	});
	for (const viewport of ['390px mobile', '920px tablet', '1440px desktop']) {
		for (const phase of ['before', 'after'] as const) {
			const pair = { title: `Settings ${phase}`, category: 'Settings', comparison: 'settings' };
			const id = `${viewport.split(' ')[1]}-${phase}`;
			await store.record(run.id, {
				kind: 'evidence',
				data: { id, ...pair, ...shown, phase, viewport }
			});
		}
	}
	await new ReportExportService(store).finalize(run.id);
	return run.id;
}

test.beforeAll(async () => {
	rmSync(evidence, { recursive: true, force: true });
	made.paired = (await audioPairFixture(root, fixtures.site('alpha-project'))).run.id;
	// Only a finalized report has an export for the server to serve.
	made.exported = await finished();
});

for (const viewport of viewports) {
	test(`every state of the reports of a site is captured at the ${viewport.id} viewport`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const [state, reach] of Object.entries(states)) {
			await reach(page);
			await captureScreen(page, state, viewport as Viewport, evidence);
		}
	});
}

test('a paired recording plays in the viewer and is captured as the server served it', async ({
	page
}) => {
	await states.audio(page);
	const player = page.getByRole('dialog').locator('audio').first();
	await expect
		.poll(() => player.evaluate((clip: HTMLAudioElement) => clip.currentSrc))
		.toContain(`${origin}/api/reports/${made.paired}/assets/`);
	expect(await captureAudio(page, 'audio', player, evidence)).toBeCloseTo(6, 0);
});

test('what was captured satisfies the reports scenario, served by the build under test', async ({
	page
}) => {
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(readFileSync('../../specification/scenarios/harness-reports.json', 'utf8'))
	);
	const { gathered, failures } = gatherCaptures(evidence, 'evidence');
	const declared = Object.keys(states);
	expect(failures).toEqual([]);
	expect(gathered.filter(({ line }) => line.kind !== 'benchmark')).toHaveLength(
		declared.length * viewports.length + 1
	);
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
	expect(
		judged.states.map((state) => [
			state.id,
			state.captures.filter((capture) => capture.kind !== 'benchmark').length
		])
	).toEqual(declared.map((state) => [state, state === 'audio' ? 4 : 3]));
	for (const { line } of gathered)
		recordCapture(
			{ ...line, file: 'reports-' + line.file },
			readFileSync(join(evidence, line.file))
		);
});
