import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import { explorerHistory } from '../../src/utils/explorer-history/explorerHistory';
import { historyDetail } from '../../src/components/explorer-ui/entity-history/explorerHistory';
import {
	complete,
	declared,
	history,
	record,
	result,
	revision,
	sha,
	summary,
	unit
} from '../explorerFixture';

const review = (commit: string, type: 'baseline' | 'approval') => ({
	type,
	commit,
	record: `r-${commit[0]}`,
	reviewer: 'Synthetic reviewer',
	reason: `Reviewed at ${commit[0]}.`,
	at: '2026-10-10T18:00:00.000Z',
	after: { 'source-bytes': 120 }
});
const point = (commit: string, size: number, complexity?: number) => ({
	commit,
	record: `r-${commit[0]}`,
	'source-bytes': size,
	...(complexity === undefined ? {} : { complexity })
});
const changes = (direct: string[], rest: { added?: string[]; removed?: string[] } = {}) => ({
	base: null,
	direct,
	added: rest.added ?? [],
	removed: rest.removed ?? []
});
const subject = 'function.slugify';
// d is the tip of main; e is a later commit of another branch that must never appear.
const index = history({
	branches: [
		{ name: 'main', head: sha('d') },
		{ name: 'other', head: sha('e') }
	],
	revisions: [
		summary(sha('e'), { parents: [sha('d')], branches: ['other'], changes: changes([subject]) }),
		// Not verified, and the same number of bytes: only the recorded change says it changed.
		summary(sha('d'), { parents: [sha('c')], coverage: 'unverified', changes: changes([subject]) }),
		summary(sha('c'), { parents: [sha('b')], subject: 'grow', changes: changes([subject]) }),
		// Verified and measured, and it did not touch the function.
		summary(sha('b'), { parents: [sha('a')], changes: changes(['function.other']) }),
		summary(sha('a'), { parents: [], subject: 'first', changes: changes([], { added: [subject] }) })
	],
	units: [
		{
			id: subject,
			growth: [
				point(sha('a'), 100, 2),
				point(sha('b'), 100, 2),
				point(sha('c'), 120),
				point(sha('e'), 999, 9)
			],
			reviews: [review(sha('a'), 'baseline'), review(sha('c'), 'approval')]
		}
	]
});
function scope(commit: string, from = index): ExplorerScope {
	const found = from.revisions.find((item) => item.commit === commit);
	return {
		location: { branch: 'main', commit, category: 'functions', entity: subject },
		mode: 'commit',
		branch: 'main',
		tip: sha('d'),
		commit,
		atTip: commit === sha('d'),
		parent: found?.parents[0] ?? null,
		summary: found ?? summary(commit)
	};
}
const rows = (commit: string) => explorerHistory(index, scope(commit), subject);

test('the history lists the commits that changed the entity, newest first, and nothing later', () => {
	expect(rows(sha('d')).map((row) => [row.commit, row.standing, row.change])).toEqual([
		[sha('d'), 'changed', 'direct'],
		[sha('c'), 'changed', 'direct'],
		[sha('a'), 'changed', 'added']
	]);
	expect(rows(sha('b')).map((row) => row.commit)).toEqual([sha('a')]);
	expect(rows(sha('d')).some((row) => row.commit === sha('e'))).toBe(false);
});

test('a change nothing measured or verified is listed, and a measured commit that changed nothing is not', () => {
	const [unverified] = rows(sha('d'));
	expect(unverified).toMatchObject({
		measured: null,
		sizeChange: null,
		coverage: 'unverified',
		gap: null
	});
	expect(rows(sha('d')).some((row) => row.commit === sha('b'))).toBe(false);
});

test('each row is compared with its own first parent, never with a later commit', () => {
	expect(rows(sha('d')).map((row) => row.previous)).toEqual([sha('c'), sha('b'), null]);
});

test('a measured row shows its size against the measured ancestor before it, listed or not', () => {
	const [, grown, first] = rows(sha('d'));
	expect(grown).toMatchObject({ sizeChange: 20, complexityChange: null, subject: 'grow' });
	expect(grown.measured).toMatchObject({ size: 120, complexity: null, record: 'r-c' });
	expect(first).toMatchObject({ sizeChange: null });
	expect(first.measured).toMatchObject({ size: 100, complexity: 2 });
});

test('reviewed baselines and approved growth stay with the commit they were recorded at', () => {
	const [, grown, first] = rows(sha('d'));
	expect(grown.reviews.map((item) => item.type)).toEqual(['approval']);
	expect(first.reviews.map((item) => item.reason)).toEqual(['Reviewed at a.']);
});

test('a removal is the last row of an entity, and an entity the history never names has none', () => {
	const gone = history({
		revisions: [
			summary(sha('b'), { parents: [sha('a')], changes: changes([], { removed: [subject] }) }),
			summary(sha('a'), { parents: [], changes: changes([], { added: [subject] }) })
		]
	});
	const listed = explorerHistory(gone, scope(sha('b'), gone), subject);
	expect(listed.map((row) => row.change)).toEqual(['removed', 'added']);
	expect(explorerHistory(index, scope(sha('d')), 'function.never')).toEqual([]);
});

test('a history that does not record what a commit changed says so for that commit', () => {
	const older = history({
		revisions: [
			summary(sha('c'), { parents: [sha('b')], changes: changes([subject]) }),
			summary(sha('b'), { parents: [sha('a')], changes: null }),
			summary(sha('a'), { parents: [] })
		]
	});
	const listed = explorerHistory(older, scope(sha('c'), older), subject);
	expect(listed.map((row) => [row.standing, row.change])).toEqual([
		['changed', 'direct'],
		['unknown', null],
		['unknown', null]
	]);
	expect(listed[1].gap).toBe('The source of this commit could not be compared with its parent.');
	expect(listed[2].gap).toBe('This history was built before it recorded what each commit changed.');
});

test('a stored revision says whether its commit changed the entity, and why', () => {
	const slugify = unit('function.slugify', 'function', { version: 'v7' });
	const units = {
		direct: ['function.slugify'],
		indirect: [],
		added: [],
		removed: ['function.old']
	};
	const impact = {
		base: sha('b'),
		expanded: false,
		units,
		scenarios: [],
		uncertain: [],
		changed: []
	};
	const reason = {
		unit: 'function.slugify',
		symbol: 'slugify',
		change: 'modified',
		behavior: 'Keeps long titles.',
		simplification: { attempt: 'One guard.', outcome: 'not-improved' },
		performance: { attempt: 'Not measured.', outcome: 'not-applicable' }
	};
	const scenario = declared({ units: ['function.slugify'] });
	const detail = revision([slugify], [scenario], [record([result(complete())])], {
		sourceImpact: impact,
		explanations: [reason, { ...reason, unit: 'function.other' }]
	});
	expect(historyDetail(detail, 'function.slugify')).toMatchObject({
		known: true,
		present: true,
		change: 'direct',
		version: 'v7',
		explanations: [reason],
		verdict: { passed: true }
	});
	expect(historyDetail(detail, 'function.old')).toMatchObject({
		known: true,
		present: false,
		change: 'removed',
		version: null,
		verdict: null
	});
	const blind = revision([slugify], [], []);
	expect(historyDetail(blind, 'function.slugify')).toMatchObject({ known: false, change: null });
});
