import { expect, test, type Page } from '@playwright/test';
import { readFileSync, rmSync } from 'node:fs';
import { scenarioManifestSchema } from '../../../../src/core/unitTypes';
import { gatherCaptures } from '../../../../src/utils/gatherCaptures';
import { scenarioCoverage } from '../../../../src/utils/scenarioCoverage';
import { reportBuildIdentity } from '../../src/utils/reportBuildIdentity';
import {
	captureAudio,
	captureScreen,
	evidenceDirectory,
	revision,
	servedBuild,
	viewports,
	type Viewport
} from './support/harnessCapture';
import { revision as recorded, seeded } from './support/harnessHistory';
import { emittedStates } from './support/emittedStates';
import { fixtures } from './support/fixtures';

const port = (name: string, fallback: number) => Number(process.env[name] || fallback);
const built = `http://127.0.0.1:${port('HARNESS_CONSOLE_E2E_EXPOSED_PORT', 5592)}`;
const scale = `http://127.0.0.1:${port('HARNESS_CONSOLE_E2E_SCALE_PORT', 5593)}`;
test.use({ baseURL: built });
test.describe.configure({ mode: 'serial' });

const { commits } = seeded();
const records = recorded(commits.reordered).records;
const passing = records.find((record) => record.status === 'passed');
const stale = records.find((record) =>
	record.failures.some((failure) => failure.includes('was produced by revision'))
);
const record = (page: Page, id = '') =>
	page
		.getByRole('list', { name: 'Verification records' })
		.getByRole('button', { name: `Record ${id.slice(0, 12)}` });
const screenshots = (page: Page) => page.locator('.evidence-card:not(.audio-card)');
const kept = '/harness/branch/feature/kept%231';
const budgets = (page: Page) =>
	page
		.getByRole('region', { name: 'Component details' })
		.getByRole('group', { name: 'Budgets and measurements' });

/** The map over the generated registry of several hundred units, one of them chosen. */
async function hundreds(page: Page): Promise<void> {
	await page.goto(`${scale}/harness?unit=function.generated-300`);
	await expect(page.getByText('488 of 488 components')).toBeVisible();
	await page.getByRole('group', { name: 'Component map' }).scrollIntoViewIfNeeded();
	await expect(page.locator('[data-unit="function.generated-300"]')).toBeInViewport();
}

/** The failed record of the scale fixture: hundreds of failures, told by cause and count. */
async function failures(page: Page): Promise<void> {
	const failed = recorded(commits.grown).records.find((item) => item.status === 'failed');
	await page.goto(
		`${scale}/harness/branch/main/commit/${commits.grown}/history/record/${failed?.id}`
	);
	const told = page.getByRole('group', { name: `Failures of record ${failed?.id.slice(0, 12)}` });
	await expect(told).toContainText('480 times: no baseline is established');
	await expect(told.locator('summary')).toContainText('failures as recorded');
	await page.getByRole('list', { name: 'Verification records' }).scrollIntoViewIfNeeded();
}

/** Each state the scenario declares: how to reach it and what must be on screen before capture. */
const states: Record<string, (page: Page) => Promise<void>> = {
	async map(page) {
		await page.goto(`/harness?commit=${commits.reordered}&unit=service.title`);
		const details = page.getByRole('region', { name: 'Component details' });
		await expect(details.getByRole('heading', { name: 'service.title' })).toBeVisible();
	},
	async compare(page) {
		await page.goto(`/harness?view=compare&base=${commits.baseline}&commit=${commits.shout}`);
		const impact = page.getByRole('region', { name: 'Impact' });
		await expect(impact.getByRole('list', { name: 'Directly changed' })).toContainText('slugify');
	},
	// One state as it was recorded before and after a change, each side with its own source.
	async aligned(page) {
		await page.goto(`/harness?view=compare&base=${commits.baseline}&commit=${commits.grown}`);
		const sides = page.getByRole('region', { name: 'Recorded states, before and after' });
		await sides.getByRole('combobox', { name: 'Scenario' }).selectOption('titles-page');
		await sides.getByRole('combobox', { name: 'State' }).selectOption('empty');
		await sides.getByRole('combobox', { name: 'Viewport' }).selectOption('desktop');
		await expect(sides.getByRole('list', { name: 'Aligned states' })).toContainText('before:');
		await sides.scrollIntoViewIfNeeded();
	},
	async removed(page) {
		await page.goto(`/harness?view=compare&base=${commits.established}&commit=${commits.removed}`);
		const impact = page.getByRole('region', { name: 'Impact' });
		const gone = impact.getByRole('list', { name: 'Removed' });
		await gone.getByRole('button', { name: 'function.extra' }).click();
		await expect(page.getByText('Removed in this comparison')).toBeVisible();
	},
	async history(page) {
		await page.goto(`/harness?view=history&commit=${commits.reordered}`);
		await expect(record(page, passing?.id)).toBeVisible();
	},
	async media(page) {
		await page.goto(`/harness?view=history&commit=${commits.reordered}`);
		await record(page, passing?.id).click();
		await expect(screenshots(page)).toHaveCount(6);
		await page.locator('.gallery-section').first().scrollIntoViewIfNeeded();
	},
	async rejected(page) {
		await page.goto(`/harness?view=history&commit=${commits.reordered}`);
		await record(page, stale?.id).click();
		await screenshots(page)
			.filter({ hasText: 'titles-page · empty' })
			.filter({ hasText: '1440px desktop' })
			.getByRole('button', { name: /^Open/ })
			.click();
		await expect(page.getByRole('dialog')).toContainText('Rejected capture');
	},
	async gap(page) {
		await page.goto(`/harness?view=history&commit=${commits.unverified}`);
		await expect(page.getByText('No verification record is attached to this commit')).toBeVisible();
	},
	async growth(page) {
		await page.goto('/harness?view=growth&unit=service.title');
		await expect(page.getByRole('region', { name: 'Timings of service.title' })).toBeVisible();
	},
	// A unit whose complexity nobody counted: unavailable and not frozen, with the reason.
	async unavailable(page) {
		await page.goto(`${kept}/commit/${commits.measured}/map/unit/kernel.counter`);
		await expect(budgets(page)).toContainText('complexity: unavailable: Decision points are not');
		await budgets(page).scrollIntoViewIfNeeded();
	},
	// A unit with counted and uncounted code: the counted points, and what they leave out.
	async partial(page) {
		await page.goto(`${kept}/commit/${commits.measured}/map/unit/kernel.mixed`);
		await expect(budgets(page)).toContainText('Partial: Counted in 1 of 2 code files.');
		await budgets(page).scrollIntoViewIfNeeded();
	},
	async 'unavailable-growth'(page) {
		await page.goto(`${kept}/commit/${commits.measured}/growth/unit/kernel.counter`);
		const growth = page.getByRole('table', { name: 'Growth of kernel.counter' });
		await expect(growth).toContainText('Decision points are not counted in Rust');
	},
	hundreds,
	failures,
	...emittedStates
};

test.beforeAll(() => rmSync(evidenceDirectory, { recursive: true, force: true }));

for (const viewport of viewports) {
	test(`every console state is captured at the ${viewport.id} viewport`, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const [state, reach] of Object.entries(states)) {
			await reach(page);
			await captureScreen(page, state, viewport as Viewport);
		}
	});
}

test('the recorded tone plays through the console player and is captured as it was served', async ({
	page
}) => {
	await states.media(page);
	await page
		.locator('.media-tabs')
		.getByRole('button', { name: /^Audio/ })
		.click();
	await expect(page.getByText('Synthetic test tone. No speech.')).toBeVisible();
	const seconds = await captureAudio(page, 'media', page.locator('audio').first());
	expect(seconds).toBeCloseTo(0.25, 1);
});

test('what was captured satisfies the scenario contract, and another build would not', async ({
	page
}) => {
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(readFileSync('../../specification/scenarios/harness-console.json', 'utf8'))
	);
	const { gathered, failures } = gatherCaptures(evidenceDirectory, 'evidence');
	expect(failures).toEqual([]);
	expect(gathered).toHaveLength(Object.keys(states).length * viewports.length + 1);
	// The server reports the digest of the very files it was started from.
	const served = await servedBuild(page);
	// The server reports the digest of the very files it was started from: this run's own copy.
	expect(served).toEqual({ buildId: reportBuildIdentity(fixtures.build), revision });
	const judge = (compiled: string) =>
		scenarioCoverage({
			scenario,
			commit: revision,
			gathered,
			checkFailed: false,
			builds: { declared: ['reports'], compiled: new Map([['reports', compiled]]) }
		});
	const judged = judge(served?.buildId ?? '');
	expect(judged.failures).toEqual([]);
	const tone = judged.states
		.flatMap((state) => state.captures)
		.find((item) => item.kind === 'audio');
	expect(tone).toMatchObject({
		status: 'passed',
		provenance: 'actual-capture',
		mediaType: 'audio/wav',
		transcript: 'Synthetic test tone. No speech.',
		durationSeconds: 0.25
	});
	// The same captures judged against the files of any other build are all rejected.
	const other = judge('f'.repeat(64));
	expect(other.failures).toHaveLength(gathered.length);
	expect(other.failures[0]).toMatch(
		/was served by build [0-9a-f]{12}, not the reports build f{12}/
	);
});
