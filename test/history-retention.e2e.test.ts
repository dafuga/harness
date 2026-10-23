import type { Index } from './history-retention.e2e.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { attach, evidenceRef, harnessJson, statusOf } from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const built = (repo: VerifyRepo) =>
	harnessJson<{ index: Index }>(repo, ['history', 'build', '--out', '.cache/history-test']).then(
		(result) => result.index
	);

test('a verified commit survives branch deletion, history rewriting and garbage collection', async () => {
	const repo = await cloneRepo(baseline);
	await repo.verify();
	await attach(repo);
	await repo.git(['checkout', '-q', '-b', 'feature']);
	const tested = await repo.change('src/utils/slugify.ts', upper);
	const { record } = await repo.verify();
	expect(record.status).toBe('passed');
	await attach(repo);
	await repo.git(['checkout', '-q', 'main']);
	await repo.git(['branch', '-q', '-D', 'feature']);
	await repo.git(['reflog', 'expire', '--expire=now', '--all']);
	await repo.git(['gc', '-q', '--prune=now']);

	expect(await repo.git(['cat-file', '-t', tested])).toBe('commit');
	expect(await repo.git(['branch', '--contains', tested])).toBe('');
	const status = await statusOf(repo, tested);
	expect([status.verified, status.records.map((item) => item.record)]).toEqual([true, [record.id]]);
	const index = await built(repo);
	expect(index.branches.map((branch) => branch.name)).toEqual(['main']);
	expect(index.revisions.find((revision) => revision.commit === tested)).toMatchObject({
		coverage: 'verified',
		retained: true,
		branches: []
	});
	await repo.dispose();
}, 240_000);

test('a note copied to a rewritten commit does not verify it', async () => {
	const repo = await cloneRepo(baseline);
	await repo.verify();
	const original = await repo.change('src/utils/slugify.ts', upper);
	await repo.verify();
	await attach(repo);
	expect((await statusOf(repo)).verified).toBe(true);
	await repo.git(['commit', '-q', '--amend', '-m', 'feat: the same tree under another message']);
	const rewritten = await repo.git(['rev-parse', 'HEAD']);
	expect(rewritten).not.toBe(original);
	expect(await repo.git(['rev-parse', `${rewritten}^{tree}`])).toBe(
		await repo.git(['rev-parse', `${original}^{tree}`])
	);
	await repo.git(['notes', '--ref=harness', 'copy', original, rewritten]);

	const status = await statusOf(repo, rewritten);
	expect([status.verified, status.records]).toEqual([false, []]);
	expect(status.problems).toContainEqual(
		expect.stringMatching(
			new RegExp(`^note line \\d+ was written for commit ${original}, not this commit$`)
		)
	);
	const check = await repo.run(['verify', 'check', '--commit', rewritten]);
	expect(check.exitCode).toBe(1);
	expect((await statusOf(repo, original)).verified).toBe(true);
	await repo.dispose();
}, 240_000);

test('evidence and notes are not source: they change no branch, impact or verification', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', upper);
	const impact = () => repo.run(['impact', '--base', 'HEAD~1', '--head', 'HEAD', '--json']);
	const before = (await impact()).stdout;
	const first = await repo.verify();
	await attach(repo);
	expect((await impact()).stdout).toBe(before);
	expect(await repo.git(['status', '--porcelain'])).toBe('');
	const again = await repo.verify();
	expect(again.record.source).toEqual(first.record.source);
	expect(again.record.impact).toEqual(first.record.impact);

	const index = await built(repo);
	expect(index.branches.map((branch) => branch.name)).toEqual(['main']);
	const evidence = await repo.git(['rev-parse', evidenceRef]);
	expect(index.revisions.map((revision) => revision.commit)).not.toContain(evidence);
	for (const range of [
		['--base', 'harness-evidence'],
		['--head', 'harness-evidence']
	]) {
		const refused = await repo.run(['impact', ...range, '--json']);
		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain('is an evidence revision, not source');
	}
	await repo.dispose();
}, 240_000);
