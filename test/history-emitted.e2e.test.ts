import type { Unit, View } from './history-emitted.e2e.test.types';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { emittedRepo, resized } from './support/emittedRepo';
import { build, type Built } from './support/historyIndexFixture';
import { attach } from './support/historyRepo';
import { reviewer, type VerifyRepo } from './support/verifyRepo';

let repo: VerifyRepo;
let built: Built;
const commits: Record<string, string> = {};
const unit = (id: string) =>
	(built.index.units as unknown as Unit[]).find((item) => item.id === id) as Unit;
const view = async (commit: string, id: string) => {
	const text = await readFile(join(built.out, 'revisions', `${commit}.json`), 'utf8');
	const detail = JSON.parse(text) as { registry: { units: View[] } };
	return detail.registry.units.find((item) => item.id === id);
};

beforeAll(async () => {
	repo = await emittedRepo();
	commits.first = await repo.git(['rev-parse', 'HEAD~1']);
	commits.baseline = await repo.git(['rev-parse', 'HEAD']);
	await attach(repo, ['--commit', commits.first]);
	await attach(repo, ['--commit', commits.baseline]);
	// The process output grows while the Wasm output shrinks, and a reviewer approves both.
	commits.swapped = await resized(repo, 'slugify', 'p7 w1');
	const blocked = await repo.verify();
	await attach(repo, ['--record', blocked.record.id]);
	await repo.harness([
		'budget',
		'approve',
		'function.slugify',
		'--record',
		blocked.record.id,
		...reviewer
	]);
	commits.approved = await repo.commit('chore: approve the sizes of slugify');
	await attach(repo, ['--record', (await repo.verify()).record.id]);
	// Then the Wasm output is no longer built at all.
	commits.vanished = await resized(repo, 'slugify', 'p7 w0');
	await attach(repo, ['--record', (await repo.verify()).record.id]);
	built = await build(repo, join(repo.root, '.cache/history'));
}, 300_000);
afterAll(() => repo.dispose());

test('each measured commit has one emitted size for every target, and none where nothing was built', () => {
	const sized = unit('function.slugify').growth.map((point) => [point.commit, point.emitted]);
	// The commits that only wrote the ledger were measured too, and measured the same build.
	expect(sized).toEqual([
		[commits.first, { process: 3, wasm: 5 }],
		[commits.baseline, { process: 3, wasm: 5 }],
		[commits.swapped, { process: 7, wasm: 1 }],
		[commits.approved, { process: 7, wasm: 1 }],
		[commits.vanished, { process: 7 }]
	]);
	const gone = unit('function.slugify').growth.at(-1);
	expect(gone?.notes).toMatchObject({
		'artifact-bytes:wasm': 'artifacts/slugify.wasm was not built in the verified snapshot.'
	});
	// An output that was never built has no size at any commit, and says why.
	const clock = unit('function.clock').growth[0];
	expect([clock.emitted, clock.notes?.['artifact-bytes:wasm']]).toEqual([
		undefined,
		'artifacts/clock.wasm was not built in the verified snapshot.'
	]);
	// A module emits nothing: no size, and no note that would read as a gap.
	expect(unit('service.title').growth[0].emitted).toBeUndefined();
	expect(built.problems).toEqual([]);
});

test('the reviews of a unit are kept with the limits before and after, at the commit they measured', () => {
	const [first, approval] = unit('function.slugify').reviews ?? [];
	expect([first.type, first.commit, first.reviewer]).toEqual([
		'baseline',
		commits.first,
		'Reviewer One'
	]);
	expect(first.after).toMatchObject({ 'artifact-bytes:process': 3, 'artifact-bytes:wasm': 5 });
	expect([approval.type, approval.commit, approval.reason]).toEqual([
		'approval',
		commits.swapped,
		'Reviewed fixture change'
	]);
	expect(approval.before).toMatchObject({ 'artifact-bytes:process': 3, 'artifact-bytes:wasm': 5 });
	expect(approval.after).toMatchObject({ 'artifact-bytes:process': 7, 'artifact-bytes:wasm': 1 });
	expect(unit('function.clock').reviews?.[0].unmeasured).toEqual({
		'artifact-bytes:wasm': 'artifacts/clock.wasm was not built in the verified snapshot.'
	});
});

test('a revision states the limits its own ledger freezes for each target, and no more', async () => {
	// Before any review there is no limit, although the unit already emits two outputs.
	expect((await view(commits.first, 'function.slugify'))?.emitted).toEqual({ limits: {} });
	expect((await view(commits.baseline, 'function.slugify'))?.emitted).toEqual({
		limits: { process: 3, wasm: 5 }
	});
	// The commit that grew was verified under the limits it broke; the approval came after it.
	expect((await view(commits.swapped, 'function.slugify'))?.emitted?.limits).toEqual({
		process: 3,
		wasm: 5
	});
	expect((await view(commits.vanished, 'function.slugify'))?.emitted?.limits).toEqual({
		process: 7,
		wasm: 1
	});
	expect((await view(commits.baseline, 'function.clock'))?.emitted).toEqual({
		limits: {},
		unmeasured: { wasm: 'artifacts/clock.wasm was not built in the verified snapshot.' }
	});
	expect(await view(commits.baseline, 'service.title')).not.toHaveProperty('emitted');
});

test('a revision states the reviewed source limits of a unit, and none before anything was reviewed', async () => {
	// The first commit declares its units frozen and has no ledger: no limit may be claimed for it.
	expect(await view(commits.first, 'function.slugify')).not.toHaveProperty('limits');
	expect(await view(commits.first, 'service.title')).not.toHaveProperty('limits');
	const reviewed = (await view(commits.baseline, 'function.slugify'))?.limits;
	expect(Object.keys(reviewed?.metrics ?? {}).sort()).toEqual([
		'complexity',
		'dependencies',
		'source-bytes'
	]);
	// The numbers are those the first record measured, which the baseline froze.
	const first = unit('function.slugify').reviews?.[0].after ?? {};
	expect(reviewed?.metrics).toEqual({
		'source-bytes': first['source-bytes'],
		complexity: first.complexity,
		dependencies: first.dependencies
	});
	expect((await view(commits.vanished, 'service.title'))?.limits?.metrics).toHaveProperty(
		'source-bytes'
	);
});
