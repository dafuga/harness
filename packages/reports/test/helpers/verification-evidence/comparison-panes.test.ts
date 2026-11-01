import { expect, test } from 'vitest';
import { comparisonPanes } from '../../../src/helpers/verification-evidence/comparisonPanes';
import { measureWorkload } from '../../../../../test/support/measureWorkload';

test('comparisonPanes keeps labels, commits, values and gaps on their own revision', async () => {
	await measureWorkload(
		'reports.helper.verification-evidence-comparison-panes',
		'revision-pair',
		assertRevisionPair
	);
});

function assertRevisionPair() {
	const before = { commit: 'a12bc34def', value: { build: 'orders-parent' } };
	const after = { commit: 'b56de78abc', value: { build: 'orders-selected' } };
	const panes = comparisonPanes(before, after);
	expect(panes.map(({ heading, role, value }) => ({ heading, role, build: value?.build }))).toEqual(
		[
			{ heading: 'Before · a12bc34', role: 'Parent commit', build: 'orders-parent' },
			{ heading: 'After · b56de78', role: 'Selected commit', build: 'orders-selected' }
		]
	);
	expect(panes[0].value).toBe(before.value);
	expect(panes[1].value).toBe(after.value);
	expect(comparisonPanes(null, after)[0]).toMatchObject({
		side: 'before',
		value: undefined,
		gap: 'No evidence is recorded for this side.'
	});
	expect(
		comparisonPanes(before, { commit: after.commit, gap: 'No selected recording.' })[1]
	).toMatchObject({
		side: 'after',
		commit: after.commit,
		value: undefined,
		gap: 'No selected recording.'
	});
	expect(comparisonPanes(before, after, false)).toMatchObject([
		{
			phase: 'current',
			heading: 'Current snapshot · b56de78',
			role: 'Branch tip',
			value: after.value
		}
	]);
	expect(comparisonPanes(null, { value: 0 }, false)[0].gap).toBeUndefined();
	let reads = 0;
	const source = {
		commit: after.commit,
		get value() {
			reads++;
			return after.value;
		}
	};
	expect(comparisonPanes(before, source)[1].value).toBe(after.value);
	expect(reads).toBe(1);
	const error = new Error('Evidence unavailable');
	expect(() =>
		comparisonPanes(null, {
			get value() {
				throw error;
			}
		})
	).toThrow(error);
}
