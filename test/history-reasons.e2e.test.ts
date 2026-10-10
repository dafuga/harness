import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { harnessJson, noteLines } from './support/historyRepo';
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
