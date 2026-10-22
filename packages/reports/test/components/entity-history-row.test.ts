import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityHistoryRow from '../../src/components/harness/entity-history-row/EntityHistoryRow.svelte';
import type { ExplorerHistoryDetail, ExplorerHistoryRow } from '../../src/models/Explorer.types';
import { nav, place } from '../entityPlaces';
import { verdicts, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const subject = `feat: ${'register every unit of the analytics client '.repeat(4).trim()}`;
const row = (changed: Partial<ExplorerHistoryRow> = {}): ExplorerHistoryRow => ({
	commit: commits.middle,
	subject,
	author: 'Fixture',
	committedAt: '2026-10-09T09:00:00.000Z',
	coverage: 'verified',
	previous: commits.first,
	standing: 'changed',
	change: 'direct',
	gap: null,
	measured: null,
	sizeChange: null,
	complexityChange: null,
	reviews: [],
	...changed
});
const read = (changed: Partial<ExplorerHistoryDetail> = {}): ExplorerHistoryDetail => ({
	known: true,
	present: true,
	change: 'direct',
	version: 'v1',
	explanations: [],
	verdict: null,
	...changed
});
const to = place({ category: 'functions', entity: ids.filter });
const shown = (of: ExplorerHistoryRow, detail?: ExplorerHistoryDetail, viewed = false) =>
	render(EntityHistoryRow, {
		props: {
			row: of,
			detail,
			timing: undefined,
			verdict: { passed: false, label: 'Evidence missing', reasons: ['No record judges it.'] },
			selected: false,
			viewed,
			to,
			nav: nav(to),
			onselect: () => {}
		}
	}).body;

test('a commit with no recorded reason is told by its subject, held to the limit of one', () => {
	const body = shown(row());
	const told = /<td class="ex-said[^"]*">(.*?)<\/td>/s.exec(body)?.[1] ?? '';
	expect([...words(told).trim()].length).toBeLessThanOrEqual(72);
	expect(words(told).trim().endsWith('…')).toBe(true);
	expect(subject.startsWith(words(told).trim().slice(0, -2))).toBe(true);
	// Nothing is measured and nothing was tried: both are said, neither is a zero.
	expect(words(body)).toContain('Not measured Not measured Not measured');
	expect(body).not.toContain('Full reasons');
});

test('commit rows omit lifecycle badges from index and revision change metadata', () => {
	for (const change of ['added', 'removed', 'direct', 'indirect'] as const) {
		const body = shown(row({ change }));
		expect(words(body), 'History lifecycle badges').not.toMatch(/\bAdded\b|\bRemoved\b/);
		expect(words(body)).toContain('bbbbbbb');
	}
	const unknown = row({ standing: 'unknown', change: null, gap: 'Not recorded.' });
	expect(
		words(shown(unknown, read({ change: 'added' }))),
		'History lifecycle badges'
	).not.toContain('Added');
});

test('the commit itself opens the revision without evidence or a duplicate action', () => {
	const body = shown(row(), undefined, true);
	expect(verdicts(body), 'Compact commit history').toEqual([]);
	expect(body).not.toContain('View revision');
	expect(words(body)).not.toContain('Viewed commit');
	expect(body).toContain('class="viewed"');
	expect(body).toContain(`href="${nav(to).href(to)}"`);
	expect(body).toContain('title="2026-10-09T09:00:00.000Z"');
	expect(words(body)).toMatch(/ago|yesterday|today|just now/);
});
