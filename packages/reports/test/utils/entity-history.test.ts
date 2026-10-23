import { expect, test } from 'vitest';
import {
	entityHistory,
	historyListed,
	historyProfiles,
	historyVerdict
} from '../../src/components/explorer-ui/entity-history/entityHistory';
import { reviewChanges } from '../../src/components/explorer-ui/entity-change/entityHistory';
import { signedBytes, signedCount } from '../../src/utils/entityHistory';
import { explorerHistory } from '../../src/utils/explorer-history/explorerHistory';
import { historyDetail } from '../../src/components/explorer-ui/entity-history/explorerHistory';
import { index, record, revision } from '../entityFixture';
import { answers, view } from '../entityPlaces';
import { commits, ids } from '../entityUnits';

const rows = answers(view('commit'), ids.filter).history;
const none = new Map();

test('a history lists the commits the index records as changes, and never a later one', () => {
	const { listed, unread } = historyListed(rows, none);
	expect(listed.map((row) => [row.commit, row.change])).toEqual([
		[commits.middle, 'direct'],
		[commits.first, 'added']
	]);
	expect(unread).toEqual([]);
	expect(JSON.stringify(rows)).not.toContain(commits.tip);
	// The tip changed nothing of the filter: it is in the ancestry and is not a row of its history.
	const tip = answers(view('current'), ids.filter).history;
	expect(historyListed(tip, none).listed.map((row) => row.commit)).toEqual([
		commits.middle,
		commits.first
	]);
});

test('a history that does not record changes lists a commit only once its revision says so', () => {
	const older = {
		...index,
		revisions: index.revisions.map(({ changes: _changes, ...kept }) => kept)
	};
	const at = view('commit');
	const unknown = explorerHistory(older, at.scope, ids.list);
	expect(unknown.map((row) => row.standing)).toEqual(['unknown', 'unknown']);
	expect(historyListed(unknown, none).listed).toEqual([]);
	expect(historyListed(unknown, none).unread.map((row) => row.commit)).toEqual([
		commits.middle,
		commits.first
	]);
	const head = revision(commits.middle, [record(commits.middle)]);
	const read = new Map([[commits.middle, historyDetail(head, ids.list)]]);
	const found = historyListed(unknown, read);
	expect(found.listed.map((row) => row.commit)).toEqual([commits.middle]);
	expect(found.unread.map((row) => row.commit)).toEqual([commits.first]);
	// The card was read at the same commit and was not changed there: it is not listed.
	const card = new Map([[commits.middle, historyDetail(head, ids.card)]]);
	expect(historyListed(explorerHistory(older, at.scope, ids.card), card).listed).toEqual([]);
});

test('each listed commit has its timings by profile, beside the value of the commit before it', () => {
	const timings = entityHistory(index, ids.filter, rows);
	expect(timings.get(commits.middle)).toEqual([
		{
			profile: 'bun-reference',
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			unit: 'ms',
			before: 0.15,
			after: 0.12
		},
		{
			profile: 'ci-linux',
			workload: 'thousand-orders',
			metric: 'p95-ms',
			target: null,
			unit: 'ms',
			after: 0.31
		}
	]);
	expect(timings.get(commits.first)?.[0]).not.toHaveProperty('before');
	expect(historyProfiles(timings)).toEqual(['bun-reference', 'ci-linux']);
});

test('only the listed commits are read: a later tip is never part of an earlier history', () => {
	const older = entityHistory(index, ids.filter, rows.slice(1));
	expect([...older.keys()]).toEqual([commits.first]);
	expect(JSON.stringify([...older.values()])).not.toContain('0.12');
	expect(entityHistory(index, ids.card, [])).toEqual(new Map());
});

test('approved growth says what the limit was and became', () => {
	expect(rows[0].reviews.map(reviewChanges)).toEqual([['source bytes 1000 → 1200']]);
	const baseline = {
		...rows[0].reviews[0],
		before: undefined,
		after: { 'artifact-bytes:wasm': 18000 }
	};
	expect(reviewChanges(baseline)).toEqual(['emitted size (Wasm) 18000']);
});

test('a change has its direction, and no earlier value is no change to show', () => {
	expect(signedBytes(200)).toBe('+200 B');
	expect(signedBytes(-1500)).toBe('−1.5 KB');
	expect(signedBytes(0)).toBe('No change');
	expect(signedBytes(null)).toBe('');
	expect([signedCount(-1), signedCount(2), signedCount(null)]).toEqual(['−1', '+2', '']);
});

test('evidence of a commit is binary: verified is the only check, everything else a cross', () => {
	expect(historyVerdict('verified')).toEqual({ passed: true, label: 'Full coverage passed' });
	expect(historyVerdict('failed')).toEqual({ passed: false, label: 'Verification failed' });
	expect(historyVerdict('invalid')).toEqual({ passed: false, label: 'Evidence unusable' });
	expect(historyVerdict('unverified')).toEqual({ passed: false, label: 'Evidence missing' });
});
