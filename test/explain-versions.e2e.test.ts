import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { explanationsFile } from '../src/core/explanationTypes';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

type Parts = Partial<Record<'behavior' | 'simplification' | 'performance', string>>;
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const range = ['--base', 'HEAD~1', '--head', 'HEAD'];
const about = 'function.slugify slugify';
const before = '2026-10-01T00:00:00.000Z';
const written = (parts: Parts = {}) => [
	...['explain', 'add', '--unit', 'function.slugify', '--symbol', 'slugify'],
	...['--behavior', parts.behavior ?? 'Shouts titles.'],
	...['--simplification', parts.simplification ?? 'One call was the smallest form.'],
	...['--simplification-outcome', 'not-improved'],
	...['--performance', parts.performance ?? 'No hot path is touched.'],
	...['--performance-outcome', 'not-applicable']
];
const scratch = (repo: VerifyRepo) => readFile(join(repo.root, explanationsFile), 'utf8');
const check = (repo: VerifyRepo, at = range) => repo.run(['explain', 'check', ...at]);
const slugify = 'src/utils/slugify.ts';

/** Declares one version of the writing limits in the verification config of the working tree. */
async function declare(repo: VerifyRepo, writing: 1 | 2): Promise<void> {
	const config = await repo.json<Record<string, unknown>>('harness.verify.json');
	await repo.write('harness.verify.json', JSON.stringify({ ...config, writing }));
}

/** A committed change of one function, in a revision that declares a version of the limits. */
async function changed(writing: 1 | 2): Promise<VerifyRepo> {
	const repo = await cloneRepo(baseline);
	await declare(repo, writing);
	await repo.write(slugify, (await repo.read(slugify)).replace('toLowerCase', 'toUpperCase'));
	await repo.commit('feat: shout titles');
	return repo;
}

/** Puts a copy of the newest reason into the store with other words and any date, by hand. */
async function injected(repo: VerifyRepo, parts: Parts, recordedAt: string): Promise<void> {
	const lines = (await scratch(repo)).trim().split('\n');
	const last = JSON.parse(lines[lines.length - 1]) as Record<string, { outcome: string }>;
	const attempt = (name: 'simplification' | 'performance') =>
		parts[name] ? { [name]: { ...last[name], attempt: parts[name] } } : {};
	const copy = { ...last, ...attempt('simplification'), ...attempt('performance'), recordedAt };
	await writeFile(
		join(repo.root, explanationsFile),
		[...lines, JSON.stringify(copy), ''].join('\n')
	);
}

test('under writing 2 an attempt of 16 words is refused when it is written, and nothing is stored', async () => {
	const repo = await changed(2);
	const stored = await scratch(repo);
	const refusals: Array<[Parts, string]> = [
		[{ simplification: words(16) }, 'simplification attempt has 16 words; the limit is 15.'],
		[{ performance: words(16) }, 'performance attempt has 16 words; the limit is 15.'],
		[
			{ simplification: '😀'.repeat(141) },
			'simplification attempt has 141 characters; the limit is 140.'
		],
		[{ behavior: words(31) }, 'behavior has 31 words; the limit is 30.'],
		[{ behavior: 'é'.repeat(201) }, 'behavior has 201 characters; the limit is 200.']
	];
	for (const [parts, said] of refusals) {
		const refused = await repo.run([...written(parts), ...range]);
		expect([said, refused.exitCode, refused.stderr.includes(`${about}: ${said}`)]).toEqual([
			said,
			1,
			true
		]);
		expect(await scratch(repo)).toBe(stored);
	}
	// Exactly at every limit, in characters of more than one byte, it is stored as it was written.
	const exact = { behavior: words(30), simplification: words(15), performance: '😀'.repeat(140) };
	expect((await repo.run([...written(exact), ...range])).exitCode).toBe(0);
	const kept = (await scratch(repo)).slice(stored.length);
	expect([kept.includes(`"${words(15)}"`), kept.includes('😀'.repeat(140))]).toEqual([true, true]);
	expect((await check(repo)).exitCode).toBe(0);
	expect((await repo.verify()).record.reasons.status).toBe('passed');
	await repo.dispose();
}, 180_000);

test('a revision that declares writing 1 keeps its 20 words, written or put in by hand', async () => {
	const repo = await changed(1);
	const refused = await repo.run([...written({ simplification: words(21) }), ...range]);
	expect(refused.stderr).toContain(
		`${about}: simplification attempt has 21 words; the limit is 20.`
	);
	expect((await repo.run([...written({ simplification: words(16) }), ...range])).exitCode).toBe(0);
	await injected(repo, { simplification: words(20), performance: words(20) }, before);
	expect((await check(repo)).exitCode).toBe(0);
	const verified = await repo.verify();
	expect(verified.record.reasons.status).toBe('passed');
	const [relied] = verified.record.reasons.entries ?? [];
	expect([relied.simplification.attempt, relied.performance.attempt]).toEqual([
		words(20),
		words(20)
	]);
	// One word more is refused there as it always was.
	await injected(repo, { performance: words(21) }, new Date().toISOString());
	const over = await check(repo);
	expect([
		over.exitCode,
		over.stderr.includes('performance attempt has 21 words; the limit is 20.')
	]).toEqual([1, true]);
	await repo.dispose();
}, 180_000);

test('a note put in by hand for a writing 2 change is held to 15 words, whatever date it carries', async () => {
	const repo = await changed(2);
	expect((await repo.run([...written(), ...range])).exitCode).toBe(0);
	for (const [recordedAt, behavior] of [
		[new Date().toISOString(), 'Shouts every title.'],
		[before, 'Shouts each title.']
	]) {
		await injected(repo, { simplification: words(16) }, recordedAt);
		const refused = await check(repo);
		const said = `${about}: simplification attempt has 16 words; the limit is 15.`;
		expect([refused.exitCode, refused.stderr.includes(said)]).toEqual([1, true]);
		// A shorter note for the same exact change settles it; the long one stays stored.
		expect((await repo.run([...written({ behavior }), '--replace', ...range])).exitCode).toBe(0);
		expect((await check(repo)).exitCode).toBe(0);
	}
	await injected(repo, { performance: words(16) }, before);
	const verified = await repo.verify();
	expect([verified.exitCode, verified.record.status, verified.record.reasons.status]).toEqual([
		1,
		'failed',
		'failed'
	]);
	expect(verified.record.failures).toContain(
		`${about}: performance attempt has 16 words; the limit is 15.`
	);
	await repo.dispose();
}, 180_000);

test('a range of both versions holds each step to its own version', async () => {
	const repo = await changed(1);
	const [base, first] = [
		await repo.git(['rev-parse', 'HEAD~1']),
		await repo.git(['rev-parse', 'HEAD'])
	];
	expect((await repo.run([...written({ simplification: words(20) }), ...range])).exitCode).toBe(0);
	// The next commit adopts version 2 and changes the same function again.
	await declare(repo, 2);
	await repo.write(slugify, (await repo.read(slugify)).replace('.trim()', '.trimEnd()'));
	await repo.commit('feat: keep leading space');
	const [whole, step] = [
		['--base', base, '--head', 'HEAD'],
		['--base', first, '--head', 'HEAD']
	];
	// A note for the whole range ends in version 2 content: it gets no older allowance.
	const refused = await repo.run([...written({ simplification: words(16) }), ...whole]);
	expect([refused.exitCode, refused.stderr.includes('has 16 words; the limit is 15.')]).toEqual([
		1,
		true
	]);
	expect(
		(await repo.run([...written({ behavior: 'Shouts and keeps leading space.' }), ...whole]))
			.exitCode
	).toBe(0);
	await injected(repo, { simplification: words(20) }, before);
	const dated = await check(repo, whole);
	expect([
		dated.exitCode,
		dated.stderr.includes('simplification attempt has 20 words; the limit is 15.')
	]).toEqual([1, true]);
	// The second step gets a note of its own at the new limit, and one more word is refused.
	expect((await repo.run([...written({ simplification: words(16) }), ...step])).exitCode).toBe(1);
	expect((await repo.run([...written({ simplification: words(15) }), ...step])).exitCode).toBe(0);
	// Each step is now explained under its own version: the twenty words of the first stay valid.
	// The check counts the one change of the range; the record below names both notes it relied on.
	const explained = await check(repo, whole);
	expect([explained.exitCode, explained.stdout.trim()]).toEqual([
		0,
		'Every change is explained: 1 reasons.'
	]);
	const verified = await repo.verify();
	expect(verified.record.reasons.status).toBe('passed');
	const counted = (verified.record.reasons.entries ?? []).map(
		(entry) => entry.simplification.attempt.split(' ').length
	);
	expect(counted).toEqual([20, 15]);
	await repo.dispose();
}, 240_000);
