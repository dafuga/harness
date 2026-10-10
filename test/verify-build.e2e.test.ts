import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { compileBundle, identityOf, pageCaptures, servedRepo } from './support/servedRepo';
import { cloneRepo, type VerifyRepo } from './support/verifyRepo';

let base: VerifyRepo;
let scratch: string;
const hash = /^[0-9a-f]{64}$/;
const brief = (id: string) => id.slice(0, 12);
const files = ['empty', 'filled'].flatMap((state) =>
	['desktop', 'tablet', 'mobile'].map((viewport) => `${state}-${viewport}.png`)
);
const change = (repo: VerifyRepo) =>
	repo.change('src/utils/slugify.ts', (source) => source.replace('toLowerCase', 'toUpperCase'));

beforeAll(async () => {
	base = await servedRepo();
	scratch = await mkdtemp(join(tmpdir(), 'harness-served-'));
}, 180_000);
afterAll(async () => {
	await base.dispose();
	await rm(scratch, { recursive: true, force: true });
});

test('captures served by the build compiled from the verified tree pass, and the record names it', async () => {
	const repo = await cloneRepo(base);
	const head = await change(repo);
	const outcome = await repo.verify();
	expect([outcome.exitCode, outcome.record.status, outcome.record.failures]).toEqual([
		0,
		'passed',
		[]
	]);
	expect(outcome.record.builds).toEqual([
		{ id: 'site', directory: 'build', buildId: expect.stringMatching(hash), files: 2 }
	]);
	const [built] = outcome.record.builds ?? [];
	const captures = pageCaptures(outcome);
	expect(captures).toHaveLength(6);
	for (const capture of captures) {
		expect(capture.server).toEqual({ buildId: built.buildId, revision: head });
		expect(capture.status).toBe('passed');
	}
	// The identity is a function of the compiled files alone, so anyone can recompute it.
	const again = join(scratch, 'same');
	await compileBundle(repo, again);
	expect(await identityOf(repo, again)).toBe(built.buildId);
	await writeFile(join(again, 'assets/app.js'), 'tampered');
	expect(await identityOf(repo, again)).not.toBe(built.buildId);
	await repo.dispose();
}, 240_000);

test('an old bundle relabelled with the current revision is rejected', async () => {
	const repo = await cloneRepo(base);
	const old = join(scratch, 'old-bundle');
	await compileBundle(repo, old);
	const stale = await identityOf(repo, old);
	const head = await change(repo);
	const outcome = await repo.verify([], { FIXTURE_OLD_BUNDLE: old });
	expect([outcome.exitCode, outcome.record.status]).toEqual([1, 'failed']);
	const [built] = outcome.record.builds ?? [];
	expect(built.buildId).not.toBe(stale);
	// Every capture carries the current revision and still names the bundle it really came from.
	const captures = pageCaptures(outcome);
	expect(captures).toHaveLength(6);
	for (const capture of captures) {
		expect(capture.server).toEqual({ buildId: stale, revision: head });
		expect(capture.status).toBe('failed');
	}
	expect(outcome.record.failures).toEqual(
		files.map(
			(file) =>
				`titles-page: capture ${file} was served by build ${brief(stale)}, not the site build ${brief(built.buildId)} compiled from this revision`
		)
	);
	expect(outcome.record.scenarios.find((item) => item.id === 'titles-page')?.status).toBe('failed');
	const check = await repo.run(['verify', 'check', '--json']);
	expect(check.exitCode).toBe(1);
	await repo.dispose();
}, 240_000);

test('page evidence must name a declared build that setup really produced', async () => {
	const unnamed = await cloneRepo(base);
	const path = 'specification/scenarios/titles-page.json';
	const scenario = await unnamed.json<{ evidence: object[] }>(path);
	const evidence = scenario.evidence.map((entry) => ({ ...entry, build: 'elsewhere' }));
	await unnamed.write(path, JSON.stringify({ ...scenario, evidence }));
	await unnamed.commit('chore: name a build that is not declared');
	const first = await unnamed.verify();
	expect(first.exitCode).toBe(1);
	expect(first.record.failures).toEqual(
		files.map(
			(file) =>
				`titles-page: capture ${file} names build elsewhere, which harness.verify.json does not declare`
		)
	);
	await unnamed.dispose();

	const repo = await cloneRepo(base);
	const config = await repo.json<{ setup: object[] }>('harness.verify.json');
	await repo.write('harness.verify.json', JSON.stringify({ ...config, setup: [] }));
	await repo.commit('chore: stop compiling the site');
	const outcome = await repo.verify(['--base', 'none']);
	expect(outcome.exitCode).toBe(1);
	expect(outcome.record.failures).toContain(
		'build site was not produced: setup left no files in build'
	);
	expect(outcome.record.builds).toEqual([]);
	await repo.dispose();
}, 300_000);
