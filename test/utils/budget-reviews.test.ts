import { expect, test } from 'vitest';
import type { BudgetEvent } from '../../src/core/budgetTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { budgetReviews } from '../../src/services/history-index-service/budgetReviews';
import { emittedLimits, frozenLimits } from '../../src/utils/revision-registry/budgetReviews';
import { unitGrowth } from '../../src/services/history-index-service/historySeries';

const [first, second] = ['a', 'b'].map((letter) => letter.repeat(40));
const signed = (commit: string, at: string) => ({
	unit: 'kernel.impact',
	record: { id: `record-${commit[0]}`, commit, tree: commit },
	reviewer: 'Reviewer One',
	reason: 'Reviewed',
	at,
	performance: []
});
const sizes = (process: number, wasm: number) => ({
	'source-bytes': 10,
	'artifact-bytes:process': process,
	'artifact-bytes:wasm': wasm
});
const baseline: BudgetEvent = {
	type: 'baseline',
	...signed(first, '2026-10-11T00:00:01Z'),
	metrics: sizes(3, 5)
};
const approval: BudgetEvent = {
	type: 'approval',
	...signed(second, '2026-10-11T00:00:02Z'),
	before: sizes(3, 5),
	after: sizes(7, 1)
};
const unit = (kinds: string[]) =>
	({
		id: 'kernel.impact',
		runtime: { targets: kinds.map((kind) => ({ kind, entry: `target/${kind}` })) }
	}) as unknown as ComponentManifest;

test('every review is kept once, in the order of the ledger, at the commit it measured', () => {
	// The ledger of a later revision repeats the lines of an earlier one.
	const reviews = budgetReviews([[baseline], [baseline, approval]]).get('kernel.impact');
	expect(reviews).toEqual([
		{
			type: 'baseline',
			commit: first,
			record: 'record-a',
			reviewer: 'Reviewer One',
			reason: 'Reviewed',
			at: '2026-10-11T00:00:01Z',
			after: sizes(3, 5)
		},
		expect.objectContaining({
			type: 'approval',
			commit: second,
			before: sizes(3, 5),
			after: sizes(7, 1)
		})
	]);
	expect(budgetReviews([]).size).toBe(0);
});

test('a revision states a limit for each target that has one, and nothing for a unit that emits nothing', () => {
	const both = unit(['module', 'process', 'wasm']);
	expect(emittedLimits(both, { metrics: sizes(3, 5), performance: [] })).toEqual({
		limits: { process: 3, wasm: 5 }
	});
	const never = {
		metrics: { 'artifact-bytes:process': 3 },
		unmeasured: { 'artifact-bytes:wasm': 'No toolchain.' }
	};
	expect(emittedLimits(both, { ...never, performance: [] })).toEqual({
		limits: { process: 3 },
		unmeasured: { wasm: 'No toolchain.' }
	});
	// A unit that emits outputs and has no baseline, or one older than these limits, has none yet.
	expect(emittedLimits(both, undefined)).toEqual({ limits: {} });
	expect(emittedLimits(both, { metrics: { 'source-bytes': 10 }, performance: [] })).toEqual({
		limits: {}
	});
	expect(
		emittedLimits(unit(['module']), { metrics: sizes(3, 5), performance: [] })
	).toBeUndefined();
});

test('the source limits of a revision are the reviewed numbers, and nothing where nothing was reviewed', () => {
	// No baseline: the manifest may declare a freeze, but no limit exists to state.
	expect(frozenLimits(undefined)).toBeUndefined();
	const reviewed = { metrics: { ...sizes(3, 5), complexity: 2 }, performance: [] };
	expect(frozenLimits(reviewed)).toEqual({ metrics: { 'source-bytes': 10, complexity: 2 } });
	const uncounted = {
		metrics: { 'source-bytes': 10 },
		unmeasured: { complexity: 'Not counted in Rust.', 'artifact-bytes:wasm': 'Not built.' },
		performance: []
	};
	expect(frozenLimits(uncounted)).toEqual({
		metrics: { 'source-bytes': 10 },
		unmeasured: { complexity: 'Not counted in Rust.' }
	});
});

test('growth takes the sizes of the unit itself and not what a benchmark reported about its run', () => {
	const base = {
		unit: 'kernel.impact',
		unitOfMeasure: 'bytes',
		method: 'm',
		testedRevision: first,
		artifacts: []
	};
	const own = { ...base, workload: null, profile: null };
	const reported = { ...base, workload: null, profile: 'machine' };
	const record = {
		id: 'record-a',
		measurements: [
			{ ...own, metric: 'source-bytes', value: 100 },
			{ ...own, metric: 'artifact-bytes', target: 'process', value: 402048 },
			{
				...own,
				metric: 'artifact-bytes',
				target: 'wasm',
				value: null,
				unavailable: 'It was not built.'
			},
			{
				...own,
				metric: 'artifact-bytes',
				value: null,
				unavailable: 'A module unit emits no separate artifact.'
			},
			// What the kernel benchmark says about itself: another source size, and sizes per target.
			{ ...reported, metric: 'source-bytes', target: 'process', value: 999 },
			{ ...reported, metric: 'artifact-bytes', target: 'process', value: 1 },
			{ ...reported, metric: 'artifact-bytes', target: 'module', value: null, unavailable: 'none' }
		]
	} as unknown as VerificationRecord;
	const reviews = budgetReviews([[baseline]]);
	expect(unitGrowth([record], reviews)).toEqual([
		{
			id: 'kernel.impact',
			growth: [
				{
					commit: first,
					record: 'record-a',
					'source-bytes': 100,
					emitted: { process: 402048 },
					notes: { 'artifact-bytes:wasm': 'It was not built.' }
				}
			],
			reviews: reviews.get('kernel.impact')
		}
	]);
	expect(unitGrowth([record])[0]).not.toHaveProperty('reviews');
});
