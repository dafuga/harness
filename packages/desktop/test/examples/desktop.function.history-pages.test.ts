import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { historyPages } from '../../src/components/git-source-history/history-panel/historyPages';
import type { HistoryEvent } from './desktop.function.history-pages.test.types';

const UNIT = 'desktop.function.history-pages';
const DETAIL = 'Committed change. Measurements and verification are recorded separately.';

function event(id: string, title: string, at = '2026-11-08T11:05:17Z'): HistoryEvent {
	return { id, at, kind: 'commit', title, detail: DETAIL, commit: id, version: null };
}

function summary(events: HistoryEvent[]) {
	return events.map(({ id, title }) => ({ id, title }));
}

const newest = event(
	'9c41e7a2d5b0f83e6a17c4d92b8e05f1a3d6c7e4',
	'Keep first occurrence when combining history pages',
	'2026-11-09T18:20:44Z'
);
const shared = event(
	'4e0a93d7b16c2f58e9d04a7c3b61f2e85d9a0c36',
	'Load the next history page on demand'
);
const sharedCopy = { ...shared, title: 'Edited copy of the same event' };
const older = event(
	'7f2c58b0e4a19d63c7b2e5f08a4d19c6e3b7a25f',
	'Add history coverage to entity detail',
	'2026-11-07T16:42:09Z'
);

test('keeps the first occurrence of each event across pages', () => {
	const merged = historyPages([newest, shared], [sharedCopy, older]);

	expect(merged).toEqual([newest, shared, older]);
	expect(merged[1]).toBe(shared);
	expect(merged).toHaveLength(3);

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'historyPages',
			state: 'keeps-the-first-occurrence-of-each-event-across-pages',
			evidence: 'examples-cases',
			file: 'keeps-the-first-occurrence-of-each-event-across-pages.json'
		},
		[
			{
				name: 'later page repeats an event with different fields',
				input: {
					pages: [
						[newest.id, shared.id],
						[sharedCopy.id, older.id]
					]
				},
				output: summary(merged)
			}
		]
	);
});

test('returns an empty list when no pages are given', () => {
	const none = historyPages();
	const empty = historyPages([]);

	expect(none).toEqual([]);
	expect(empty).toEqual([]);

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'historyPages',
			state: 'returns-an-empty-list-when-no-pages-are-given',
			evidence: 'examples-cases',
			file: 'returns-an-empty-list-when-no-pages-are-given.json'
		},
		[
			{ name: 'no page arguments', input: { pages: [] }, output: none },
			{ name: 'one empty page', input: { pages: [[]] }, output: empty }
		]
	);
});

test('keeps pages in argument order even when timestamps disagree', () => {
	const merged = historyPages([older, newest, older], [newest]);

	expect(merged).toEqual([older, newest]);
	expect(merged[0]).toBe(older);

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'historyPages',
			state: 'keeps-pages-in-argument-order-even-when-timestamps-disagree',
			evidence: 'examples-cases',
			file: 'keeps-pages-in-argument-order-even-when-timestamps-disagree.json'
		},
		[
			{
				name: 'repeated id within a page and across pages',
				input: { pages: [[older.id, newest.id, older.id], [newest.id]] },
				output: summary(merged)
			}
		]
	);
});
