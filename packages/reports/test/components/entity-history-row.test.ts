import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityHistoryRow from '../../src/components/harness/EntityHistoryRow.svelte';
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
const shown = (of: ExplorerHistoryRow, detail?: ExplorerHistoryDetail) =>
	render(EntityHistoryRow, {
		props: {
			row: of,
			detail,
			timing: undefined,
			verdict: { passed: false, label: 'Evidence missing', reasons: ['No record judges it.'] },
			selected: false,
			viewed: false,
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
	expect(words(body)).toContain('— Not measured Not measured Not measured');
	expect(body).not.toContain('Full reasons');
});

test('what the commit did to the entity is a pill, also once only its revision says so', () => {
	expect(words(shown(row({ change: 'added' })))).toContain('bbbbbbb Added');
	expect(words(shown(row({ change: 'removed' })))).toContain('bbbbbbb Removed');
	expect(words(shown(row()))).not.toMatch(/Added|Removed/);
	const unknown = row({ standing: 'unknown', change: null, gap: 'Not recorded.' });
	expect(words(shown(unknown, read({ change: 'added' })))).toContain('bbbbbbb Added');
});

test('the evidence of a row is the mark alone, with its status and reason in the tooltip', () => {
	const body = shown(row());
	expect(verdicts(body)).toEqual([
		{ passed: false, name: 'Evidence missing', reasons: ['No record judges it.'] }
	]);
	expect(words(body)).not.toMatch(/Evidence missing|No record judges it/);
	expect(body).toContain('aria-label="View revision bbbbbbb"');
});
