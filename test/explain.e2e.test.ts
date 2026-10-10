import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, reason, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const range = ['--base', 'HEAD~1', '--head', 'HEAD'];

test('a changed function without a reason blocks verification until it is explained', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('src/utils/slugify.ts', upper(await repo.read('src/utils/slugify.ts')));
	await repo.commit('feat: unexplained change');
	const missing = {
		unit: 'function.slugify',
		symbol: 'slugify',
		file: 'src/utils/slugify.ts',
		change: 'modified',
		state: 'missing'
	};
	const blocked = await repo.verify();
	expect([blocked.exitCode, blocked.record.status]).toEqual([1, 'failed']);
	expect(blocked.record.reasons).toMatchObject({ status: 'failed', missing: [missing] });
	expect(blocked.record.failures).toEqual([
		'function.slugify: slugify in src/utils/slugify.ts was modified without a reason'
	]);
	const check = await repo.run(['explain', 'check', ...range]);
	expect(check.exitCode).toBe(1);
	expect(check.stderr).toContain('function.slugify: slugify in src/utils/slugify.ts');
	const listed = JSON.parse((await repo.run(['explain', 'list', '--json', ...range])).stdout);
	expect(listed.required).toEqual([missing]);

	const add = ['explain', 'add', '--unit', 'function.slugify', '--symbol', 'slugify'];
	const noPerformance = await repo.run([...add, ...reason.slice(0, 6), ...range]);
	expect(noPerformance.exitCode).toBe(1);
	expect(noPerformance.stderr).toContain('--performance');
	const badOutcome = await repo.run([...add, ...reason.slice(0, 9), 'faster', ...range]);
	expect(badOutcome.stderr).toContain('improved, not-improved or not-applicable');

	await repo.harness([...add, ...reason, ...range]);
	const explained = await repo.verify();
	expect([explained.exitCode, explained.record.status]).toEqual([0, 'passed']);
	expect(explained.record.reasons.entries).toEqual([
		expect.objectContaining({
			unit: 'function.slugify',
			symbol: 'slugify',
			behavior: 'Fixture change.',
			simplification: { attempt: 'Nothing simpler was found.', outcome: 'not-improved' },
			performance: { attempt: 'No hot path is touched.', outcome: 'not-applicable' }
		})
	]);
	await repo.dispose();
}, 120_000);

test('a reason goes stale when the function changes again', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('src/utils/slugify.ts', upper(await repo.read('src/utils/slugify.ts')));
	await repo.explainAll();
	await repo.write(
		'src/utils/slugify.ts',
		(await repo.read('src/utils/slugify.ts')).replace('trim()', 'trimEnd()')
	);
	await repo.commit('feat: edited after explaining');
	const { record } = await repo.verify();
	expect(record.reasons.missing).toEqual([
		expect.objectContaining({ unit: 'function.slugify', symbol: 'slugify', state: 'stale' })
	]);
	expect(record.failures[0]).toBe(
		'function.slugify: slugify in src/utils/slugify.ts was modified after its reason was written'
	);
	await repo.dispose();
}, 120_000);

test('added, removed and unindexed units need unit-wide reasons', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('scripts/tool.py', 'print("one")\n');
	await repo.write('src/utils/extra.ts', 'export function extra(): number {\n\treturn 1;\n}\n');
	await repo.harness(['units', 'index', '--write']);
	await repo.commit('feat: add units');
	const added = JSON.parse((await repo.run(['explain', 'list', '--json', ...range])).stdout);
	expect(added.required).toEqual([
		{ unit: 'function.extra', symbol: '*', change: 'added', state: 'missing' },
		{ unit: 'script.tool', symbol: '*', change: 'added', state: 'missing' }
	]);
	await repo.explainAll(range);

	await repo.write('scripts/tool.py', 'print("two")\n');
	await repo.git(['rm', '-q', 'src/utils/extra.ts']);
	await repo.harness(['units', 'retire', 'function.extra', '--reason', 'Unused']);
	await repo.harness(['units', 'index', '--write']);
	await repo.commit('feat: change and remove');
	const changed = JSON.parse((await repo.run(['explain', 'list', '--json', ...range])).stdout);
	expect(changed.required).toEqual([
		{ unit: 'function.extra', symbol: '*', change: 'removed', state: 'missing' },
		{
			unit: 'script.tool',
			symbol: '<module>',
			file: 'scripts/tool.py',
			change: 'modified',
			state: 'missing'
		}
	]);
	await repo.dispose();
}, 120_000);
