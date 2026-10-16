import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { attach, harnessJson, noteLines } from './support/historyRepo';
import { baselineRepo, cloneRepo, repoAt, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

interface Persisted {
	commit: string;
	base: string | null;
	attached: number;
	missing: string[];
}
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const renamed = (from: string, to: string) => (source: string) => source.replaceAll(from, to);
interface Shown {
	explanations: Array<{ unit: string; symbol: string; from: string | null; to: string | null }>;
	rangeReasons: number;
	records: Array<{ id: string }>;
}
/** The reasons a built history shows for one commit, and how many more it keeps apart. */
async function shown(out: string, commit: string) {
	const detail = JSON.parse(
		await readFile(join(out, 'revisions', `${commit}.json`), 'utf8')
	) as Shown;
	const units = detail.explanations.map((entry) => entry.unit);
	return { ...detail, units };
}

test('the reasons of a committed range are kept in notes and explain it in any working tree', async () => {
	const repo = await cloneRepo(baseline);
	const head = await repo.change('src/utils/slugify.ts', upper);
	const persisted = await harnessJson<Persisted>(repo, ['history', 'reasons']);
	expect(persisted).toEqual({
		commit: head,
		base: await repo.git(['rev-parse', 'HEAD~1']),
		attached: 1,
		missing: []
	});
	const reasons = (await noteLines(repo)).filter((line) => line.kind === 'reason');
	expect(reasons.map((line) => [line.explanation?.unit, line.explanation?.symbol])).toEqual([
		['function.slugify', 'slugify']
	]);
	expect(await repo.git(['rev-parse', 'HEAD'])).toBe(head);

	const secondRoot = join(repo.root, '..', 'second');
	await repo.git(['worktree', 'add', '-q', '--detach', secondRoot, head]);
	const second = repoAt(secondRoot);
	const range = ['--base', 'HEAD~1', '--head', 'HEAD'];
	const check = await second.run(['explain', 'check', ...range]);
	expect([check.exitCode, check.stdout.trim()]).toEqual([
		0,
		'Every change is explained: 1 reasons.'
	]);
	const again = await harnessJson<Persisted>(repo, ['history', 'reasons']);
	expect(again.attached).toBe(1);
	expect((await noteLines(repo)).filter((line) => line.kind === 'reason')).toHaveLength(1);
	await repo.dispose();
}, 180_000);

test('a change without a reason is reported and nothing is invented for it', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('src/utils/slugify.ts', upper(await repo.read('src/utils/slugify.ts')));
	await repo.commit('feat: unexplained change');
	const result = await repo.run(['history', 'reasons', '--json']);
	expect(result.exitCode).toBe(1);
	expect(JSON.parse(result.stdout)).toMatchObject({
		attached: 0,
		missing: ['function.slugify: slugify in src/utils/slugify.ts was modified without a reason']
	});
	expect(await repo.git(['notes', '--ref=harness', 'list'])).toBe('');
	await repo.dispose();
}, 120_000);

test('a record of a longer range does not date the reasons of earlier commits to its commit', async () => {
	const repo = await cloneRepo(baseline);
	const proven = await repo.git(['rev-parse', 'HEAD']);
	// Two explained commits. Only the second is verified, so its record reaches back to the
	// last proven revision and holds the reason of the first as well.
	const first = await repo.change('src/utils/slugify.ts', upper);
	await harnessJson<Persisted>(repo, ['history', 'reasons']);
	const second = await repo.change('src/utils/clock.ts', renamed('value', 'valor'));
	const verified = await repo.verify();
	expect([verified.record.status, verified.record.source.base]).toEqual(['passed', proven]);
	const held = (verified.record.reasons.entries ?? []).map((entry) => entry.unit).sort();
	expect(held).toEqual(['function.clock', 'function.slugify']);
	await attach(repo);
	// A second record of the same commit and range: nothing is counted or shown twice.
	const again = await repo.verify();
	expect(again.record.id).not.toBe(verified.record.id);
	await attach(repo, ['--record', again.record.id]);
	// The next commit is verified against its own parent: its record is exactly its change.
	const third = await repo.change('src/utils/slugify.ts', renamed('input', 'value'));
	const exact = await repo.verify();
	expect([exact.record.status, exact.record.source.base]).toEqual(['passed', second]);
	await attach(repo);
	const out = join(repo.root, '.cache/history-reasons');
	await repo.harness(['history', 'build', '--out', out]);

	const [old, later, last] = await Promise.all([first, second, third].map((at) => shown(out, at)));
	// The earlier commit keeps the reason it noted; the later one does not take it over.
	expect(old.units).toEqual(['function.slugify']);
	expect([later.units, later.rangeReasons]).toEqual([['function.clock'], 1]);
	expect(later.records.map((record) => record.id).sort()).toEqual(
		[verified.record.id, again.record.id].sort()
	);
	// The same unit changed again later: that commit shows its own reason, not the first one.
	expect([last.units, last.rangeReasons]).toEqual([['function.slugify'], 0]);
	expect(last.explanations[0].from).toBe(old.explanations[0].to);
	expect(last.explanations[0]).not.toEqual(old.explanations[0]);
	// What was attached stays as it was written: the notes still hold the whole range.
	const noted = (await noteLines(repo, second)).filter((line) => line.kind === 'reason');
	expect([...new Set(noted.map((line) => line.explanation?.unit))].sort()).toEqual(held);
	await repo.dispose();
}, 420_000);
