import { expect, test } from 'vitest';
import { historyPages } from '../../src/components/git-source-history/history-panel/historyPages';
import type { HistoryEvent } from '../../src/models/development-tooling/Desktop.types';

const event = (id: string) => ({ id, title: id }) as HistoryEvent;

test('pages keep their order and an event that a later page repeats is listed once', () => {
	const pages = historyPages([event('a'), event('b')], [event('b'), event('c')], [event('a')]);
	expect(pages.map((item) => item.id)).toEqual(['a', 'b', 'c']);
	expect(historyPages([], [])).toEqual([]);
});
