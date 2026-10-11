import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
const file = 'src/utils/slugify.ts';
const louder = (source: string) => source.replace('toLowerCase', 'toUpperCase');
// Not a return to what was explained before: content nobody has given a reason for.
const other = (source: string) => source.replace('toUpperCase', 'toLocaleUpperCase');
const check = (repo: VerifyRepo, head: string) =>
	repo.run(['explain', 'check', '--base', 'none', '--head', head]);

beforeAll(async () => {
	baseline = await baselineRepo();
}, 240_000);
afterAll(() => baseline.dispose());

test('a range is explained by the reasons of its steps: units as they were added, then each change', async () => {
	const repo = await cloneRepo(baseline);
	// The units were explained when they were added; this change is explained as a change.
	const changed = await repo.change(file, louder);
	const whole = await check(repo, changed);
	expect([whole.exitCode, whole.stderr]).toEqual([0, '']);
	const listed = JSON.parse(
		(await repo.run(['explain', 'list', '--base', 'none', '--head', changed, '--json'])).stdout
	) as { required: Array<{ unit: string; state: string }> };
	expect(listed.required.filter((row) => row.state !== 'explained')).toEqual([]);

	// A later step without a reason is not covered by the steps around it.
	await repo.write(file, other(await repo.read(file)));
	await repo.harness(['units', 'index', '--write']);
	const silent = await repo.commit('feat: change it again without saying why');
	const open = await check(repo, silent);
	expect(open.exitCode).toBe(1);
	expect(open.stderr).toContain('function.slugify');
	const after = await repo.change('src/utils/clock.ts', (source) =>
		source.replace('return value;', 'return value.trim();')
	);
	const still = await check(repo, after);
	expect([still.exitCode, still.stderr.includes('function.slugify')]).toEqual([1, true]);
	await repo.dispose();
}, 240_000);

test('a verification with no proven ancestor accepts changes explained step by step', async () => {
	const repo = await cloneRepo(baseline);
	// Nothing is proven any more, so everything is judged from an empty start.
	await rm(join(repo.root, '.cache/harness/verifications'), { recursive: true, force: true });
	const changed = await repo.change(file, louder);
	const outcome = await repo.verify();
	expect(outcome.record.source).toMatchObject({ commit: changed, base: null });
	expect(outcome.record.gates?.reasons).toBe('passed');
	expect(outcome.record.reasons.missing).toEqual([]);
	// Both steps are in the record: the unit as it was added, and the change to its function.
	const told = (outcome.record.reasons.entries ?? []).filter(
		(entry) => entry.unit === 'function.slugify'
	);
	expect(told.map((entry) => entry.change)).toEqual(['added', 'modified']);
	await repo.dispose();
}, 240_000);
