import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { explanationSchema, explanationsFile } from '../src/core/explanationTypes';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const range = ['--base', 'HEAD~1', '--head', 'HEAD'];
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const written = (behavior: string, simplification = 'One call was the smallest form.') => [
	'explain',
	'add',
	'--unit',
	'function.slugify',
	'--symbol',
	'slugify',
	'--behavior',
	behavior,
	'--simplification',
	simplification,
	'--simplification-outcome',
	'not-improved',
	'--performance',
	'No hot path is touched.',
	'--performance-outcome',
	'not-applicable'
];
const scratch = (repo: VerifyRepo) => readFile(join(repo.root, explanationsFile), 'utf8');

/** A committed change of one function that still needs its reason. */
async function changed(declared: boolean): Promise<VerifyRepo> {
	const repo = await cloneRepo(baseline);
	if (declared) {
		const config = await repo.json<Record<string, unknown>>('harness.verify.json');
		await repo.write('harness.verify.json', JSON.stringify({ ...config, writing: 1 }));
	}
	await repo.write('src/utils/slugify.ts', upper(await repo.read('src/utils/slugify.ts')));
	await repo.commit('feat: shout titles');
	return repo;
}

/** Puts an overlong copy of the newest reason into the scratch store, as an editor could. */
async function injected(repo: VerifyRepo): Promise<void> {
	const lines = (await scratch(repo)).trim().split('\n');
	const last = JSON.parse(lines[lines.length - 1]) as { behavior: string };
	const long = JSON.stringify({ ...last, behavior: words(31) });
	await writeFile(join(repo.root, explanationsFile), [...lines, long, ''].join('\n'));
}

test('an overlong note is refused when it is written, and nothing is stored', async () => {
	const repo = await changed(false);
	const before = await scratch(repo);
	const long = await repo.run([...written(words(31)), ...range]);
	expect(long.exitCode).toBe(1);
	expect(long.stderr).toContain(
		'function.slugify slugify: behavior has 31 words; the limit is 30.'
	);
	const giant = await repo.run([...written('x'.repeat(201)), ...range]);
	expect(giant.stderr).toContain('behavior has 201 characters; the limit is 200.');
	const attempt = await repo.run([...written('Shouts titles.', words(21)), ...range]);
	expect(attempt.stderr).toContain('simplification attempt has 21 words; the limit is 20.');
	expect(await scratch(repo)).toBe(before);
	// Exactly at the limits it is stored as it was written.
	const exact = await repo.run([...written(words(30), words(20)), ...range]);
	expect(exact.exitCode).toBe(0);
	expect(await scratch(repo)).toContain(words(30));
	expect((await repo.run(['explain', 'check', ...range])).exitCode).toBe(0);
}, 120_000);

test('an overlong reason put into the store by hand fails the check and the verification', async () => {
	const repo = await changed(true);
	expect((await repo.run([...written('Shouts titles.'), ...range])).exitCode).toBe(0);
	expect((await repo.run(['explain', 'check', ...range])).exitCode).toBe(0);
	await injected(repo);
	const check = await repo.run(['explain', 'check', ...range]);
	expect(check.exitCode).toBe(1);
	expect(check.stderr).toContain(
		'function.slugify slugify: behavior has 31 words; the limit is 30.'
	);
	const verified = await repo.verify();
	expect([verified.exitCode, verified.record.status]).toEqual([1, 'failed']);
	expect(verified.record.reasons.status).toBe('failed');
	expect(verified.record.failures).toContain(
		'function.slugify slugify: behavior has 31 words; the limit is 30.'
	);
}, 180_000);

test('a repository that has not adopted the limits keeps its long reasons valid', async () => {
	const repo = await changed(false);
	expect((await repo.run([...written('Shouts titles.'), ...range])).exitCode).toBe(0);
	await injected(repo);
	expect((await repo.run(['explain', 'check', ...range])).exitCode).toBe(0);
	const verified = await repo.verify();
	expect(verified.record.reasons.status).toBe('passed');
	// What was stored before the limits is still read as it is: the schema has no maximum.
	const stored = (await scratch(repo))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(() => stored.map((entry) => explanationSchema.parse(entry))).not.toThrow();
	expect(stored.some((entry: { behavior: string }) => entry.behavior === words(31))).toBe(true);
}, 180_000);

test('an overlong reason is replaced through explain add --replace, and the earlier one stays stored', async () => {
	const repo = await changed(true);
	expect((await repo.run([...written('Shouts titles.'), ...range])).exitCode).toBe(0);
	// Nothing is missing and nothing is too long: there is nothing to replace.
	const idle = await repo.run([...written('Shouts every title.'), '--replace', ...range]);
	expect(idle.exitCode).toBe(1);
	await injected(repo);
	expect((await repo.run(['explain', 'check', ...range])).exitCode).toBe(1);
	// Without the flag an explained change is not written again, as before.
	const plain = await repo.run([...written('Shouts every title.'), ...range]);
	expect([plain.exitCode, plain.stderr.includes('No unexplained change')]).toEqual([1, true]);
	const before = (await scratch(repo)).trim().split('\n');
	const replaced = await repo.run([...written('Shouts every title.'), '--replace', ...range]);
	expect([replaced.exitCode, replaced.stdout.trim()]).toEqual([0, 'Recorded 1 reason.']);
	const after = (await scratch(repo)).trim().split('\n');
	// The store only grows: every earlier line is there as it was, the long one included.
	expect(after.slice(0, before.length)).toEqual(before);
	expect(after).toHaveLength(before.length + 1);
	const [long, short] = [before[before.length - 1], after[after.length - 1]].map(
		(line) => JSON.parse(line) as { behavior: string; from: string; to: string }
	);
	expect(long.behavior).toBe(words(31));
	expect(short).toMatchObject({ behavior: 'Shouts every title.', from: long.from, to: long.to });
	expect((await repo.run(['explain', 'check', ...range])).exitCode).toBe(0);
	const verified = await repo.verify();
	expect(verified.record.reasons.status).toBe('passed');
	// A replacement is held to the limits like any new reason.
	await injected(repo);
	const again = await repo.run([...written(words(31)), '--replace', ...range]);
	expect(again.exitCode).toBe(1);
	expect(again.stderr).toContain('behavior has 31 words; the limit is 30.');
}, 240_000);
