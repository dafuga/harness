import { expect, test } from 'vitest';
import { checkTrackerItem as check } from '../../../src/utils/projects-sessions/checkTrackerItem';
import { measureWorkload } from '../../support/measureWorkload';

const unit = 'function.projects-sessions-check-tracker-item';
const base = { title: 'Build runner queue', status: 'open' };

const rankedRows = [
	{ ...base, id: 'other-ignored', status: 'ignored' },
	{
		...base,
		id: 'same-ignored',
		agent: 'fixture',
		status: 'ignored',
		title: 'Build runner queue overflow',
		ignored_reason: 'already triaged',
		needs_daniel: 1,
		resolved: 1
	},
	{ ...base, id: 'exact-open', needs_daniel: 1, question: 'Any further details?' },
	{ ...base, id: 'finished', status: 'done' },
	{ ...base, id: 'deleted', deleted: 1 },
	{ ...base, id: 'incomplete', status: null }
];

test('check prioritizes same-agent ignored items and returns resolved question flags truthfully', () =>
	measureWorkload(unit, 'rank-open-and-ignored-candidates', () => {
		const plain = {
			title: base.title,
			agent: null,
			owner: null,
			question: null,
			score: 1,
			shared: ['build', 'runner', 'queue'],
			same_agent: false,
			needs_daniel: false
		};
		const ignore = {
			ignored_by: null,
			ignored_at: null,
			ignored_until: null,
			ignored_reason: null
		};
		expect(check(rankedRows, 'Please build the runners queue', { agent: 'fixture' })).toEqual({
			ignored: [
				{
					...plain,
					...ignore,
					id: 'same-ignored',
					status: 'ignored',
					agent: 'fixture',
					title: 'Build runner queue overflow',
					ignored_reason: 'already triaged',
					same_agent: true
				},
				{ ...plain, ...ignore, id: 'other-ignored', status: 'ignored' }
			],
			open: [
				{
					...plain,
					id: 'exact-open',
					status: 'open',
					needs_daniel: true,
					question: 'Any further details?'
				}
			]
		});
	}));

test('check requires strict Dice above 0.8 for open items and admits containment for ignored ones', () => {
	const title = 'Renew build runner service credential';
	const rows = [
		{ id: 'open', title, status: 'open' },
		{ id: 'ignored', title, status: 'ignored' },
		{ id: 'excluded', title: 'Renew build worker service credential', status: 'open' }
	];
	const matches = check(rows, 'Renew build worker service credential', { excludeId: 'excluded' });
	expect(matches.open).toEqual([]);
	expect(matches.ignored.map(({ id, score }) => [id, score])).toEqual([['ignored', 0.8]]);
	expect(check(rows, 'please do it')).toEqual({ ignored: [], open: [] });
	expect(() => check(rows, ' ')).toThrow('check needs some text to search for');
});
