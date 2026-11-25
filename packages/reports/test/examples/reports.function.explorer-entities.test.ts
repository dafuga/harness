import { test } from 'vitest';
import {
	explorerChange,
	explorerEntities,
	explorerEntity
} from '../../src/utils/explorer-ui/explorerEntities';
import type { HarnessRevision, HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import { impacted, revision, sha, unit } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

import { pending, projected } from './reports.function.explorer-entities.projection';
import type { Helper, Impact, Cases, Row } from './reports.function.explorer-entities.test.types';

const unitId = 'reports.function.explorer-entities';
/** Records one named symbol's cases as a trace of their inputs and results. */
function trace(symbol: string, state: string, cases: Cases): boolean {
	const file = `${state}.json`;
	return recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
}

/** A callable with two distinct consumers, so the explorer lists it as a function. */
const shared: Helper[] = [
	{
		name: 'toKebabCase',
		source: 'packages/reports/src/utils/toKebabCase.ts',
		inputs: [],
		pure: true,
		consumers: [{ unit: 'component.a' }, { unit: 'component.b' }]
	}
];
const source = (path: string) => ({ source: [path], symbols: [] });
const rendered = (slug: string, title: string) =>
	unit(`reports.page.${slug}`, 'page', {
		title,
		owns: source(`packages/reports/src/routes/${slug}/+page.svelte`)
	});
const layout = (slug: string, title: string, path: string) =>
	unit(`reports.layout.${slug}`, 'layout', { title, owns: source(path) });

/** The verdict of a unit the commit removed, shown as its first parent last held it. */
const removedVerdict = {
	passed: false,
	label: 'Removed at this commit',
	reasons: ['This commit removed it; its contract is shown as it last was, at bbbbbbb.']
};

/** A listed entity the explorer shows unchanged, with no verification record yet. */
const entry = (id: string, category: Row['category'], role: string, name: string): Row => ({
	id,
	category,
	role,
	name,
	change: null,
	appRoute: null,
	lastAt: null,
	verdict: pending
});

const titles = rendered('titles', 'Titles');
const frame = layout('frame', 'Frame', 'packages/reports/src/components/Frame.svelte');
const bare = layout('bare', 'Bare', 'packages/reports/src/routes/bare.ts');
const config = layout('config', 'Config layout', 'packages/reports/src/routes/+layout.ts');
const kebab = unit('reports.function.kebab', 'helper', {
	title: 'toKebabCase',
	helpers: shared,
	owns: { source: ['packages/reports/src/utils/toKebabCase.ts'], symbols: ['toKebabCase'] }
});
const unshared = unit('reports.function.unshared', 'helper', { title: 'unshared', helpers: [] });
const retired = unit('reports.page.retired', 'page', { title: 'Retired', status: 'retired' });
const lint = unit('reports.rule.lint', 'rule', { title: 'Lint rule' });
const refunds = unit('reports.service.refunds', 'service', { title: 'Refund service' });

test('lists the scoped roster of categorized units in category order, with layouts and helpers', () => {
	const head = revision(
		[refunds, kebab, unshared, bare, frame, config, titles, retired, lint],
		[],
		[]
	);
	const actual = explorerEntities(head).map(projected);
	expect(actual).toEqual([
		{ ...entry('reports.page.titles', 'pages', 'Page', 'Titles'), appRoute: '/titles' },
		entry('reports.layout.frame', 'layouts', 'Layout', 'Frame'),
		entry('reports.function.kebab', 'functions', 'Helper', 'toKebabCase'),
		entry('reports.layout.config', 'configs', 'Route configuration', 'Config layout'),
		entry('reports.service.refunds', 'services', 'Service', 'Refund service')
	]);
	trace('explorerEntities', 'roster-of-categorized-units-in-category-order', [
		{
			name: 'roster with unshared, bare, retired and rule units',
			input: { units: head.registry.units.map((item) => item.id) },
			output: actual
		}
	]);
});

/** One explorerEntity lookup as a case: the unit's identity, the selection, and the result. */
function lookup(name: string, target: HarnessUnit, includePrivate?: boolean) {
	const output = projected(explorerEntity(revision([], [], []), target, includePrivate));
	return {
		name,
		input: { id: target.id, kind: target.kind, includePrivate: includePrivate ?? false },
		output
	};
}

test('a unit with no category or an unrequested private function projects to null', () => {
	const privateFunction = unit('reports.function.private', 'function', { helpers: [] });
	const cases = [
		lookup('a rule has no category, even with private inclusion', lint, true),
		lookup('an unshared function is not listed without private inclusion', privateFunction),
		lookup('private inclusion lists an unshared function as a function', privateFunction, true),
		lookup('a shared function is listed the same without private inclusion', kebab, false)
	];
	expect(cases.map((item) => item.output)).toEqual([
		null,
		null,
		entry('reports.function.private', 'functions', 'Function', 'private'),
		entry('reports.function.kebab', 'functions', 'Helper', 'toKebabCase')
	]);
	trace('explorerEntity', 'no-category-or-unrequested-private-function-is-null', cases);
});

/** Units named across the lists of one commit's source impact, with one unit in none. */
const impact: Impact = {
	...impacted(sha('b')),
	units: {
		added: ['reports.page.a'],
		direct: ['reports.page.a', 'reports.page.b'],
		indirect: ['reports.page.b', 'reports.page.c'],
		removed: ['reports.page.c', 'reports.page.d']
	}
};

/** One explorerChange lookup as a case: the unit, the impact it was read from, and the mark found. */
function change(name: string, id: string, sourceImpact: Impact | null) {
	const head = revision([], [], [], { sourceImpact });
	return { name, input: { unit: id, sourceImpact }, output: explorerChange(head, id) };
}

test('the first source-impact list naming a unit gives its change mark', () => {
	const cases = [
		change('added wins over direct, indirect and removed', 'reports.page.a', impact),
		change('direct wins over indirect when both list the unit', 'reports.page.b', impact),
		change('indirect wins over removed when both list the unit', 'reports.page.c', impact),
		change('removed is the last list checked', 'reports.page.d', impact),
		change('a unit no list names has no mark', 'reports.page.e', impact),
		change('an absent source-impact record has no mark', 'reports.page.a', null)
	];
	expect(cases.map((item) => item.output)).toEqual([
		'added',
		'direct',
		'indirect',
		'removed',
		null,
		null
	]);
	trace('explorerChange', 'first-source-impact-list-gives-change-mark', cases);
});

const gone = unit('reports.service.gone', 'service', { title: 'Gone service' });
const kept = rendered('kept', 'Kept');
const fresh = rendered('new', 'New');
const loader = unit('reports.page.loader', 'page', {
	title: 'Loader',
	owns: source('packages/reports/src/routes/loader/+page.server.ts')
});
const stale = unit('reports.page.stale', 'page', { title: 'Stale', status: 'retired' });
const notes = unit('reports.rule.notes', 'rule', { title: 'Notes' });
const parent = revision([gone, kept, stale, notes, kebab], [], [], { commit: sha('b') });
const removed = [
	'reports.service.gone',
	'reports.page.kept',
	'reports.page.stale',
	'reports.rule.notes',
	'reports.function.kebab'
];
// `kept` stays active in head: its mark shows on that entity, and no removed entry repeats it.
const removalHead = revision([refunds, kept, loader, fresh], [], [], {
	commit: sha('a'),
	sourceImpact: { ...impacted(sha('b')), units: { added: [], direct: [], indirect: [], removed } }
});

test('removed units list their last parent contract after registry order within each category', () => {
	const actual = explorerEntities(removalHead, parent).map(projected);
	expect(actual).toEqual([
		{
			...entry('reports.page.kept', 'pages', 'Page', 'Kept'),
			change: 'removed',
			appRoute: '/kept'
		},
		{ ...entry('reports.page.new', 'pages', 'Page', 'New'), appRoute: '/new' },
		{
			...entry('reports.function.kebab', 'functions', 'Helper', 'toKebabCase'),
			change: 'removed',
			lastAt: sha('b'),
			verdict: removedVerdict
		},
		entry('reports.service.refunds', 'services', 'Service', 'Refund service'),
		entry('reports.page.loader', 'services', 'Route loader', 'Loader'),
		{
			...entry('reports.service.gone', 'services', 'Service', 'Gone service'),
			change: 'removed',
			lastAt: sha('b'),
			verdict: removedVerdict
		}
	]);
	trace('explorerEntities', 'removed-units-list-last-parent-contract', [
		{
			name: 'removals of a kept, stale, unlisted and categorized parent unit',
			input: { removed },
			output: actual
		}
	]);
});
