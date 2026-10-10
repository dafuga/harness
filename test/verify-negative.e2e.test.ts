import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let changed: VerifyRepo;
let head: string;
beforeAll(async () => {
	changed = await baselineRepo();
	head = await changed.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
}, 120_000);
afterAll(() => changed.dispose());

async function failing(env: Record<string, string>, args: string[] = []) {
	const repo = await cloneRepo(changed);
	const outcome = await repo.verify(args, env);
	expect([outcome.exitCode, outcome.record.status]).toEqual([1, 'failed']);
	expect(existsSync(join(outcome.directory, 'record.json'))).toBe(true);
	return { repo, ...outcome };
}

test('a missing viewport capture fails the scenario and the failed record is preserved', async () => {
	const { repo, record } = await failing({ FIXTURE_SKIP: 'filled-mobile' });
	expect(record.failures).toEqual([
		'titles-page: missing screenshot for state filled at viewport mobile'
	]);
	const page = record.scenarios.find((scenario) => scenario.id === 'titles-page');
	expect(page?.status).toBe('failed');
	expect(page?.states.flatMap((state) => state.captures)).toHaveLength(5);
	const check = await repo.run(['verify', 'check', '--json']);
	expect(check.exitCode).toBe(1);
	expect(JSON.parse(check.stdout).problems).toEqual(record.failures);
	await repo.dispose();
}, 120_000);

test('a missing state, a missing transcript and a failing test are each reported', async () => {
	const states = await failing({ FIXTURE_SKIP: 'empty-desktop,empty-tablet,empty-mobile' });
	expect(states.record.failures).toEqual(
		['desktop', 'tablet', 'mobile'].map(
			(viewport) => `titles-page: missing screenshot for state empty at viewport ${viewport}`
		)
	);
	const transcript = await failing({ FIXTURE_NO_TRANSCRIPT: '1' });
	expect(transcript.record.failures).toEqual([
		'titles-audio: audio capture for state spoken has no transcript'
	]);
	const failed = await failing({ FIXTURE_FAIL: '1' });
	expect(failed.record.failures).toEqual(['titles-page: test page failed with exit code 1']);
	const captures = failed.record.scenarios
		.find((scenario) => scenario.id === 'titles-page')
		?.states.flatMap((state) => state.captures);
	expect(captures).toHaveLength(6);
	expect(captures?.every((capture) => capture.status === 'failed')).toBe(true);
	await Promise.all([states, transcript, failed].map((item) => item.repo.dispose()));
}, 180_000);

test('a state declared missing fails verification and stays visible with its reason', async () => {
	const repo = await cloneRepo(changed);
	const path = 'specification/scenarios/titles-page.json';
	const scenario = await repo.json<{ states: object[]; evidence: Array<{ states: string[] }> }>(
		path
	);
	const missing = {
		id: 'error',
		title: 'error',
		coverage: 'missing',
		reason: 'No error fixture exists yet.'
	};
	const evidence = [{ ...scenario.evidence[0], states: ['empty', 'filled', 'error'] }];
	await repo.write(
		path,
		JSON.stringify({ ...scenario, states: [...scenario.states, missing], evidence })
	);
	await repo.commit('chore: declare an unproven error state');
	const { exitCode, record } = await repo.verify();

	expect([exitCode, record.status]).toEqual([1, 'failed']);
	expect(record.failures).toEqual([
		'titles-page: state error is declared missing: No error fixture exists yet.'
	]);
	const page = record.scenarios.find((item) => item.id === 'titles-page');
	expect(page?.status).toBe('failed');
	expect(page?.states.find((state) => state.id === 'error')).toEqual({
		id: 'error',
		coverage: 'missing',
		reason: 'No error fixture exists yet.',
		captures: []
	});
	expect(page?.states.flatMap((state) => state.captures)).toHaveLength(6);

	const excuse = { ...missing, coverage: 'inapplicable' };
	await repo.write(path, JSON.stringify({ ...scenario, states: [...scenario.states, excuse] }));
	const relabelled = await repo.run(['scenarios', 'check']);
	expect(relabelled.exitCode).toBe(1);
	expect(relabelled.stderr).toContain(
		'titles-page: state error is called inapplicable, but its reason says it is unproven'
	);
	const uncovered = { id: 'error', title: 'error', coverage: 'required' };
	await repo.write(path, JSON.stringify({ ...scenario, states: [...scenario.states, uncovered] }));
	const unproven = await repo.run(['scenarios', 'check']);
	expect(unproven.stderr).toContain('titles-page: required state error has no required evidence');
	await repo.dispose();
}, 120_000);

test('corrupt, truncated, mistyped and wrongly sized media are not accepted as evidence', async () => {
	const first = async (mode: string) => {
		const outcome = await failing({ FIXTURE_MEDIA: mode });
		await outcome.repo.dispose();
		return outcome.record.failures[0];
	};
	expect(await first('corrupt')).toBe(
		'titles-page: capture empty-desktop.png is not a valid PNG image: missing PNG signature'
	);
	expect(await first('wrongtype')).toBe(
		'titles-page: capture empty-desktop.png is not a valid PNG image: missing PNG signature'
	);
	expect(await first('truncated')).toMatch(
		/^titles-page: capture empty-desktop\.png is not a valid PNG image: truncated/
	);
	expect(await first('wrongsize')).toBe(
		'titles-page: capture empty-desktop.png is 100x100 but viewport desktop requires 1440x900'
	);
	expect(await first('audio-corrupt')).toBe(
		'titles-audio: capture spoken.wav is not playable WAV audio: missing RIFF/WAVE header'
	);
	expect(await first('audio-truncated')).toMatch(
		/^titles-audio: capture spoken\.wav is not playable WAV audio: truncated/
	);
	expect(await first('audio-duration')).toBe(
		'titles-audio: capture spoken.wav declares 9 s but contains 0.25 s of audio'
	);
}, 300_000);

test('a stale or missing build stamp is rejected', async () => {
	const stale = 'a'.repeat(40);
	const { repo, record } = await failing({ FIXTURE_STALE_REVISION: stale });
	expect(record.failures).toHaveLength(6);
	expect(record.failures[0]).toBe(
		`titles-page: capture empty-desktop.png was produced by revision ${stale}, not ${head}`
	);
	const unstamped = await failing({ FIXTURE_NO_STAMP: '1' });
	expect(unstamped.record.failures[0]).toBe(
		'titles-page: capture empty-desktop.png has no build stamp'
	);
	await Promise.all([repo.dispose(), unstamped.repo.dispose()]);
}, 180_000);

test('a test that mutates tracked source fails the snapshot check', async () => {
	const { repo, record } = await failing({ FIXTURE_MUTATE: 'src/utils/clock.ts' });
	expect(record.failures).toEqual(['snapshot mutated during verification: src/utils/clock.ts']);
	expect(await repo.read('src/utils/clock.ts')).not.toContain('mutated');
	await repo.dispose();
}, 120_000);

test('a hung test is stopped at its limit together with its children', async () => {
	const marker = join(tmpdir(), `harness-late-${Date.now()}.txt`);
	const started = Date.now();
	const { repo, record } = await failing({ FIXTURE_HANG: marker }, ['--test-timeout', '1000']);
	expect(Date.now() - started).toBeLessThan(20_000);
	expect(record.failures).toEqual([
		'titles-page: test page timed out after 1000 ms',
		...['empty', 'filled'].flatMap((state) =>
			['desktop', 'tablet', 'mobile'].map(
				(viewport) => `titles-page: missing screenshot for state ${state} at viewport ${viewport}`
			)
		)
	]);
	await new Promise((resolve) => setTimeout(resolve, 2500));
	expect(existsSync(marker)).toBe(false);
	await repo.dispose();
}, 120_000);

test('check rejects a wrong revision, a changed tree, tampered evidence and component versions', async () => {
	const repo = await cloneRepo(changed);
	const { record, directory } = await repo.verify();
	expect(record.status).toBe('passed');
	const file = join(directory, 'record.json');
	const check = async (args: string[]) => {
		const result = await repo.run(['verify', 'check', '--json', '--record', file, ...args]);
		return { exitCode: result.exitCode, problems: JSON.parse(result.stdout).problems as string[] };
	};
	expect(await check([])).toEqual({ exitCode: 0, problems: [] });

	const parent = await repo.git(['rev-parse', 'HEAD~1']);
	expect((await check(['--commit', parent])).problems).toEqual([
		`record is for commit ${head}, not ${parent}`
	]);

	const original = await readFile(file, 'utf8');
	const tampered = (edit: (value: typeof record) => void) => {
		const copy = JSON.parse(original) as typeof record;
		edit(copy);
		return writeFile(file, JSON.stringify(copy));
	};
	await tampered((copy) => (copy.source.tree = 'b'.repeat(40)));
	expect((await check([])).problems[0]).toMatch(/^record tree b+ does not match commit tree /);
	await tampered((copy) => (copy.components[0].source = 'c'.repeat(64)));
	expect((await check([])).problems).toContain(
		'component function.slugify does not match the source at this commit'
	);
	await writeFile(file, original);
	const capture = record.scenarios.find((scenario) => scenario.id === 'titles-page')?.states[0]
		.captures[0];
	await writeFile(join(directory, capture?.path ?? ''), 'tampered');
	expect((await check([])).problems).toEqual([
		`evidence ${capture?.path} does not match its recorded hash`
	]);
	await repo.dispose();
}, 120_000);
