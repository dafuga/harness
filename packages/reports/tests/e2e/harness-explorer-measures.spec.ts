import { expect, test, type Page } from '../../../../test/support/browserTest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { at, checkpoint, explorer } from './support/explorer';
import { captureSections, viewports } from './support/harnessCapture';
import { home, seeded, short } from './support/harnessHistory';
import { fits } from './support/sharedSelect';
import type { HarnessRevision } from '../../src/models/Harness.types';
import { explorerKindCategory } from '../../../../src/utils/explorerRoute';

/** Synthetic model input completes the same category fixture; it claims no real model source. */
function everyKind(): HarnessRevision {
	const detail = JSON.parse(
		readFileSync(join(home, 'data/revisions', `${commits.shelled}.json`), 'utf8')
	) as HarnessRevision;
	const template = detail.registry.units.find((unit) => unit.kind === 'config')!;
	const id = 'model.acceptance-payload';
	detail.registry.units.push({
		...template,
		id,
		kind: 'model',
		title: 'Acceptance payload',
		responsibility: 'Synthetic model input for category acceptance; it describes no real source.',
		sourceMeasurements: template.sourceMeasurements?.map((item) => ({
			...item,
			unit: id,
			method: 'Synthetic model observations copied from the config fixture for category acceptance.'
		}))
	});
	return detail;
}

/** Evidence runs require both observed figures, not merely a successful navigation. */
function expectRuntimeObservations(state: string, category: string): void {
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || process.env.TAKE_SCREENSHOT !== '1') return;
	const saved = JSON.parse(readFileSync(join(directory, `${state}-benchmark.json`), 'utf8'));
	for (const metric of ['browser-navigation-ms', 'browser-js-heap-bytes']) {
		const observation = saved.measurements.find(
			(item: { metric: string }) => item.metric === metric
		);
		expect(observation, `${category} records ${metric}`).toBeDefined();
		expect(observation.unit).toBe(`reports.page.harness-branch-branch-at-${category}-entity`);
		expect(observation.value).toBeGreaterThan(0);
	}
}

for (const viewport of viewports)
	test(`every entity kind shows selected source measurements at ${viewport.id} width`, async ({
		page
	}) => {
		const detail = everyKind();
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.route(`**/harness/data/revisions/${commits.shelled}.json`, (route) =>
			route.fulfill({ json: detail })
		);
		for (const category of [
			'pages',
			'shells',
			'components',
			'functions',
			'configs',
			'services',
			'models'
		]) {
			const unit = detail.registry.units.find(
				(unit) =>
					explorerKindCategory(unit.kind) === category &&
					(category !== 'functions' || unit.id === 'function.slugify')
			)!;
			expect(unit, `the standard fixture covers ${category}`).toBeDefined();
			await page.goto(at('feature/shells', commits.shelled, `${category}/${unit.id}`));
			const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
			await expect(profile).toBeVisible();
			await checkpoint(page, `current-measurements-${category}-${viewport.id}`);
			expectRuntimeObservations(`current-measurements-${category}-${viewport.id}`, category);
			for (const metric of ['Source size', 'Complexity']) {
				const row = profile
					.locator('dl > div')
					.filter({ has: page.getByText(metric, { exact: true }) });
				await expect(row).not.toContainText('Not measured');
				await expect(row.locator('dd')).toContainText(/\d/);
			}
			await captureSections(page, `current-measurements-${category}-${viewport.id}`, checkpoint);
		}
	});

const { commits, keptBranch } = seeded();
const { explorerUnits: units } = explorer();
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const content = (page: Page) => page.locator('.ex-content');
const profile = (page: Page) =>
	page.getByRole('region', { name: 'Performance profile', exact: true });
const metric = (page: Page, name: string) =>
	profile(page)
		.locator('dl > div')
		.filter({ has: page.getByText(name, { exact: true }) })
		.getByRole('definition');
const details = (commit: string, unit: string) =>
	at(keptBranch, commit, `functions/${unit}/details?tab=measurements`);
const recorded = (commit: string) =>
	JSON.parse(
		readFileSync(join(home, 'data/revisions', `${commit}.json`), 'utf8')
	) as HarnessRevision;
const observed = (commit: string, unit: string, metric: string, target?: string) =>
	recorded(commit)
		.records.flatMap((record) => record.measurements)
		.find(
			(item) => item.unit === unit && item.metric === metric && (!target || item.target === target)
		);
const stored = (commit: string) =>
	JSON.parse(readFileSync(join(home, 'data/revisions', `${commit}.json`), 'utf8')) as {
		explanations: Array<{ unit: string; behavior: string }>;
	};

for (const viewport of viewports) {
	test(`emitted observations retain distinct targets behind compact figures at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(details(commits.emitting, 'function.packer'));
		await expect(metric(page, 'Emitted size · Wasm')).toHaveText('5 B');
		expect(observed(commits.emitting, 'function.packer', 'artifact-bytes', 'wasm')?.value).toBe(5);
		await page.goto(details(commits.packed, 'function.packer'));
		await checkpoint(page, `measures-emitted-${viewport.id}`);
		await expect(metric(page, 'Emitted size · process (native)')).toHaveText('3 B');
		await expect(metric(page, 'Emitted size · Wasm')).toHaveText('5 B');
		expect(
			recorded(commits.packed).registry.units.find((unit) => unit.id === 'function.packer')?.emitted
				?.limits
		).toMatchObject({ process: 3, wasm: 5 });
		await page.goto(details(commits.vanished, 'function.packer'));
		await expect(metric(page, 'Emitted size · Wasm')).toContainText('Not measured');
		expect(observed(commits.vanished, 'function.packer', 'artifact-bytes', 'wasm')).toMatchObject({
			value: null,
			unavailable: expect.stringContaining('was not built in the verified snapshot')
		});
		await expect(profile(page).getByRole('table')).toHaveCount(0);
		expect(await fits(page)).toBe(true);
	});
}

test('uncounted complexity keeps its recorded reason and never becomes zero', async ({ page }) => {
	await page.goto(details(commits.measured, 'kernel.counter'));
	await checkpoint(page, 'measures-unavailable');
	await expect(metric(page, 'Complexity')).toContainText('Not measured');
	expect(observed(commits.measured, 'kernel.counter', 'complexity')?.value).toBeNull();
	expect(
		recorded(commits.measured).registry.units.find((unit) => unit.id === 'kernel.counter')?.limits
			?.unmeasured?.complexity
	).toBeTruthy();
	await page.goto(details(commits.native, 'kernel.mixed'));
	await expect(metric(page, 'Complexity')).toContainText(/^\d+/);
	expect(observed(commits.native, 'kernel.mixed', 'complexity')?.partial).toBeTruthy();
	await page.goto(details(commits.shout, units.slugify));
	await expect(metric(page, 'Complexity')).toHaveText(/^\d+$/);
	expect(
		recorded(commits.shout).registry.units.find((unit) => unit.id === units.slugify)?.limits
			?.metrics.complexity
	).toBeTypeOf('number');
	await expect(profile(page).getByRole('table')).toHaveCount(0);
});

test('reasons that differ only in the file they are about are told once, and all stay to be read', async ({
	page
}) => {
	const recorded = stored(commits.twin).explanations.filter((item) => item.unit === units.page);
	expect(recorded.length).toBeGreaterThan(1);
	// The page has two files changed for one reason: the same words, recorded once for each.
	const notes = new Set(recorded.map((item) => item.behavior)).size;
	await page.goto(at(keptBranch, commits.twin, `pages/${units.page}/history`));
	await checkpoint(page, 'measures-reasons');
	await expect(content(page).getByRole('heading', { name: 'Why it changed' })).toBeVisible();
	await expect(
		content(page)
			.getByRole('term')
			.filter({ hasText: /^Behavior$/ })
	).toHaveCount(notes);
	const full = content(page).getByRole('group').filter({ hasText: 'Full reasons' });
	await expect(full).toContainText(`${notes} ${notes === 1 ? 'note' : 'notes'}`);
	await full.locator('summary').click();
	await expect(full.getByText(recorded[0].behavior).first()).toBeVisible();
	// No file is named with a reason: where a change is, is shown under Details and Source.
	await expect(content(page).getByText(/src\/routes\/titles/)).toHaveCount(0);
});

test('a change is compared with its own parent under matching profiles, with its growth', async ({
	page
}) => {
	await page.goto(at(keptBranch, commits.twin, `pages/${units.page}/history`));
	const compared = content(page).getByRole('table', {
		name: 'Before and after, under matching profiles'
	});
	await expect(
		compared.getByRole('columnheader', { name: `Before (${short(commits.paired)})` })
	).toBeVisible();
	await expect(
		compared.getByRole('columnheader', { name: `After (${short(commits.twin)})` })
	).toBeVisible();
	await expect(compared.getByRole('row').filter({ hasText: 'Source size' })).toContainText(
		/[+−-]\d+ B/
	);
	// A timing column names the one profile its values were taken under.
	await page.goto(at('main', commits.reordered, `services/${units.service}/history`));
	await expect(
		content(page).getByRole('columnheader', { name: /^Timing \([0-9a-z-]+\)$/ })
	).toHaveCount(1);
});

test.describe('a record with hundreds of failures of other units', () => {
	test.use({ baseURL: scale });
	test('tells a unit what failed about it, and nothing about the rest', async ({ page }) => {
		const record = JSON.parse(
			readFileSync(join(home, 'scale/revisions', `${commits.grown}.json`), 'utf8')
		) as { records: Array<{ status: string; failures: string[] }> };
		const failed = record.records.find((item) => item.status === 'failed');
		expect(failed?.failures.length).toBeGreaterThan(400);
		await page.goto(at('main', commits.grown, 'functions'));
		await checkpoint(page, 'measures-failures');
		const row = page.getByRole('article', { name: 'slugify', exact: true });
		await expect(row.getByRole('button')).toHaveCount(0);
		await row.locator('.ex-function-call').click();
		const mark = page
			.locator('.ex-head')
			.getByRole('button', { name: 'Verification failed', exact: true });
		await mark.hover();
		const reasons = page.getByRole('tooltip');
		await expect(reasons).toContainText('function.slugify: source-bytes');
		await expect(reasons).not.toContainText('generated');
		expect(await fits(page)).toBe(true);
	});
});
