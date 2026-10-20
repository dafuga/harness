import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const scenarioOf = (record: { scenarios: Array<{ id: string }> }, id: string) => {
	const found = record.scenarios.find((scenario) => scenario.id === id);
	if (!found) throw new Error(`scenario ${id} missing from record`);
	return found as (typeof record.scenarios)[number] & {
		status: string;
		testedRevision: string;
		referencedRecord?: string;
		states: Array<{ id: string; coverage: string; reason?: string; captures: Capture[] }>;
	};
};
interface Capture {
	sha256: string;
	path: string;
	status: string;
	viewport?: string;
	transcript?: string;
	provenance?: string;
	mediaType: string;
	durationSeconds?: number;
	server?: { revision: string };
}

test('the fixture baseline verifies clean on an exact commit and tree', async () => {
	const repo = await cloneRepo(baseline);
	const head = await repo.git(['rev-parse', 'HEAD']);
	const { exitCode, record, directory } = await repo.verify();
	expect(record.failures).toEqual([]);
	expect([exitCode, record.status]).toEqual([0, 'passed']);
	// The parent's only record failed for want of baselines, so it proves nothing to build on:
	// the whole revision is verified, and nothing is inherited from the parent.
	expect(record.source).toEqual({
		commit: head,
		tree: await repo.git(['rev-parse', 'HEAD^{tree}']),
		base: null,
		requestedBase: await repo.git(['rev-parse', 'HEAD~1'])
	});
	expect(record.scenarios.map((scenario) => [scenario.status, scenario.testedRevision])).toEqual(
		record.scenarios.map(() => ['passed', head])
	);
	expect(existsSync(join(directory, 'record.json'))).toBe(true);
	const check = await repo.run(['verify', 'check', '--json']);
	expect(JSON.parse(check.stdout)).toMatchObject({
		status: 'passed',
		problems: [],
		record: record.id
	});
	// Now that this revision is proven, verifying it against itself inherits every scenario.
	const unchanged = await repo.verify(['--base', 'HEAD']);
	expect(unchanged.record.source.base).toBe(head);
	expect(unchanged.record.scenarios.map((scenario) => scenario.status)).toEqual(
		unchanged.record.scenarios.map(() => 'referenced')
	);
	await repo.dispose();
}, 120_000);

/** The page and audio scenarios were re-verified at `head`; the clock scenario was inherited. */
function expectScenarios(
	record: VerifyOutcome['record'],
	directory: string,
	{ head, first }: { head: string; first: string }
): void {
	const page = scenarioOf(record, 'titles-page');
	expect([page.status, page.testedRevision]).toEqual(['passed', head]);
	const captures = page.states.flatMap((state) => state.captures);
	expect(captures).toHaveLength(6);
	expect(new Set(captures.map((item) => item.viewport))).toEqual(
		new Set(['desktop', 'tablet', 'mobile'])
	);
	for (const item of captures) {
		expect(item.server?.revision).toBe(head);
		expect(item.sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(existsSync(join(directory, item.path))).toBe(true);
	}
	expect(page.states.find((state) => state.id === 'offline')).toEqual({
		id: 'offline',
		coverage: 'inapplicable',
		reason: 'The page is rendered on the server and never enters a client-side offline state.',
		captures: []
	});
	const audio = scenarioOf(record, 'titles-audio').states[0].captures[0];
	expect([audio.provenance, audio.transcript]).toEqual([
		'fixture',
		expect.stringMatching(/^Title: /)
	]);
	expect([audio.mediaType, audio.durationSeconds]).toEqual(['audio/wav', 0.25]);

	const clock = scenarioOf(record, 'clock');
	expect([clock.status, clock.testedRevision]).toEqual(['referenced', first]);
	expect(clock.referencedRecord).toMatch(/^[0-9a-f]{64}$/);
	expect(clock.states[0].captures[0].path).toContain(first);
}

test('a shared function change re-verifies its service, page and audio scenarios with fresh evidence', async () => {
	const repo = await cloneRepo(baseline);
	// The baseline commit is the nearest proven revision, so it is what last tested the clock.
	const first = await repo.git(['rev-parse', 'HEAD']);
	const head = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const { exitCode, record, directory } = await repo.verify();

	expect(record.failures).toEqual([]);
	expect([exitCode, record.status]).toEqual([0, 'passed']);
	expect(record.impact.units.direct).toEqual(['function.slugify']);
	expect(record.impact.units.indirect).toEqual(['page.titles', 'service.title']);
	expect(record.tests.map((item) => [item.target, item.status])).toEqual([
		['test/services/title.test.ts', 'passed'],
		['node scripts/fixture.mjs audio', 'passed'],
		['node scripts/fixture.mjs bench', 'passed'],
		['node scripts/fixture.mjs page', 'passed']
	]);

	expectScenarios(record, directory, { head, first });

	expect(record.components.map((item) => [item.unit, item.change])).toEqual([
		['function.slugify', 'modified'],
		['page.titles', 'unchanged'],
		['service.title', 'unchanged']
	]);
	const size = record.measurements.find(
		(item) => item.unit === 'function.slugify' && item.metric === 'source-bytes'
	);
	expect(size).toMatchObject({ value: 100, testedRevision: head, profile: null });
	expect(record.reasons.status).toBe('passed');
	expect(record.reasons.entries?.map((entry) => [entry.unit, entry.symbol])).toEqual([
		['function.slugify', 'slugify']
	]);
	expect(record.budgets.status).toBe('passed');
	await repo.dispose();
}, 120_000);

test('each tested revision regenerates evidence even when the bytes are identical', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const one = await repo.verify();
	const head = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toUpperCase', 'toLowerCase')
	);
	const two = await repo.verify();

	const hashes = (outcome: typeof one) =>
		scenarioOf(outcome.record, 'titles-page').states.flatMap((state) =>
			state.captures.map((item) => item.sha256)
		);
	expect(hashes(two)).toEqual(hashes(one));
	const page = scenarioOf(two.record, 'titles-page');
	expect([page.status, page.testedRevision]).toEqual(['passed', head]);
	expect(two.directory).not.toBe(one.directory);
	expect(two.record.id).not.toBe(one.record.id);
	for (const item of page.states.flatMap((state) => state.captures)) {
		expect(item.path).toContain(head);
		expect(existsSync(join(two.directory, item.path))).toBe(true);
	}
	await repo.dispose();
}, 120_000);

test('scenario contracts list their states, viewports, tests and evidence', async () => {
	const repo = await cloneRepo(baseline);
	const shown = JSON.parse((await repo.run(['scenarios', 'show', 'titles-page', '--json'])).stdout);
	expect(shown.required).toHaveLength(6);
	expect(shown.required[0]).toEqual({
		evidence: 'screens',
		kind: 'screenshot',
		state: 'empty',
		viewport: 'desktop'
	});
	expect(shown.unproven).toEqual([]);
	expect(shown.excluded).toEqual([
		{
			state: 'offline',
			reason: 'The page is rendered on the server and never enters a client-side offline state.'
		}
	]);
	const listed = JSON.parse((await repo.run(['scenarios', 'list', '--json'])).stdout);
	expect(listed.map((item: { id: string }) => item.id)).toEqual([
		'clock',
		'titles-audio',
		'titles-boundary',
		'titles-page'
	]);
	expect((await repo.run(['scenarios', 'check'])).exitCode).toBe(0);
	await repo.dispose();
}, 60_000);
