import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { explorerCategory, explorerRole } from '../../src/utils/explorer-ui/explorerCategory';
import { explorerEntityCategories } from '../../../../src/utils/explorerRoute';
import { modelDefinition } from '../entityClassFixtures';
import { unit } from '../explorerFixture';
import type { Row, Subject, Cases } from './reports.function.explorer-category.test.types';

const unitId = 'reports.function.explorer-category';
const compat =
	'packages/reports/src/routes/harness/branch/[branch]/[...at]/pages/[entity]/details/+page.svelte';
const shells = 'packages/reports/src/routes/harness/shells/+page.svelte';
const callers = [{ unit: 'component.one' }, { unit: 'component.two' }];
const helper = (consumers: Array<{ unit: string; symbol?: string }>, pure = true) => ({
	name: 'format',
	source: 'src/utils/format.ts',
	inputs: [],
	pure,
	consumers
});
/** A runtime class: a stored class whose table is removed. */
const runtimeClass = () => {
	const found = modelDefinition('Client', 'src/model.client.ts');
	delete found.table;
	return [found];
};

/** A unit of a kind that owns the given source paths; the id only names it. */
const row = (name: string, kind: string, source: string[], expected: string | null): Row => [
	name,
	unit(`${kind}.case`, kind, { owns: { source, symbols: [] } }),
	expected
];
/** The same row with some fields of its unit replaced. */
const patch = (item: Row, extra: Partial<Subject>): Row => [
	item[0],
	{ ...item[1], ...extra },
	item[2]
];

/** The inputs a reader needs to see, in the words of the unit's own fields. */
const shape = ({ kind, owns, catalog, helpers, modelDefinitions }: Subject) => ({
	kind,
	source: owns.source,
	catalog,
	helpers,
	models: modelDefinitions?.map(({ name, source, table }) => ({ name, source, stored: !!table }))
});

/** Calls the named export on every row, checks each result, then records the trace. */
function observe(name: 'explorerCategory' | 'explorerRole', state: string, rows: Row[]): void {
	const run = name === 'explorerCategory' ? explorerCategory : explorerRole;
	const cases: Cases = rows.map(([caseName, subject]) => ({
		name: caseName,
		input: shape(subject),
		output: run(subject)
	}));
	expect(cases.map((item) => item.output)).toEqual(rows.map((item) => item[2]));
	recordExampleCases(
		{ unitId, symbol: name, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('canonical categories are the plural entity labels, one per product kind', () => {
	const rows: Row[] = [
		row('rendered page', 'page', ['src/routes/titles/+page.svelte'], 'pages'),
		row('endpoint', 'endpoint', [], 'apis'),
		row('layout that frames pages', 'layout', ['src/routes/+layout.svelte'], 'layouts'),
		row('component', 'component', [], 'components'),
		row('shared function', 'function', [], 'functions'),
		row('configuration', 'config', [], 'configs'),
		row('service', 'service', [], 'services'),
		row('stored model', 'model', ['src/models/Order.ts'], 'models'),
		row('type declarations', 'model', ['src/models/Order.types.ts'], 'types')
	];
	observe('explorerCategory', 'canonical-plural-categories', rows);
	expect(new Set(rows.map((item) => item[2]))).toEqual(new Set(explorerEntityCategories));
});

test('a source address decides the category before the kind does', () => {
	const rows: Row[] = [
		row('component under a page address', 'component', ['src/routes/o/+page.svelte'], 'pages'),
		row('unknown kind at a page', 'never-heard-of', ['src/routes/x/+page.svelte'], 'pages'),
		row('route loader that only answers', 'page', ['src/routes/+page.server.ts'], 'services'),
		row('layout options module', 'layout', ['src/routes/+layout.ts'], 'configs'),
		row('legacy details address', 'page', [compat], 'services'),
		row('legacy shells address', 'shell', [shells], 'services'),
		row('component source that renders nothing', 'component', ['src/Button.svelte'], 'components'),
		patch(row('owned symbols are not inspected', 'component', [], 'components'), {
			owns: { source: ['src/Badge.ts'], symbols: ['Badge', 'BadgeProps'] }
		})
	];
	observe('explorerCategory', 'sources-decide-address-category', rows);
});

test('internal units and nonvisual layouts are unlisted whatever their kind', () => {
	const internal = { catalog: { visibility: 'internal' } } as Partial<Subject>;
	const rows: Row[] = [
		patch(row('internal page', 'page', ['src/routes/hidden/+page.svelte'], null), internal),
		patch(row('internal function with shared proof', 'function', [], null), internal),
		row('layout module that frames nothing', 'layout', ['src/shared/frame.ts'], null),
		row('layout without owned source', 'layout', [], null)
	];
	observe('explorerCategory', 'internal-and-nonvisual-unlisted', rows);
});

test('a function or module is listed only with a helper that helperContract accepts', () => {
	const rows: Row[] = [
		row('shared pure function, two consumers', 'function', [], 'functions'),
		patch(row('function with no helper record', 'function', [], null), { helpers: undefined }),
		patch(row('impure function, two consumers', 'function', [], null), {
			helpers: [helper(callers, false)]
		}),
		patch(row('pure module, one consumer', 'module', [], null), {
			helpers: [helper(callers.slice(0, 1))]
		}),
		patch(row('pure module, two consumers', 'module', [], 'functions'), {
			helpers: [helper(callers)]
		}),
		patch(row('same consumer listed twice', 'function', [], null), {
			helpers: [helper([callers[0], callers[0]])]
		}),
		patch(row('two symbols of one unit', 'function', [], 'functions'), {
			helpers: [
				helper([
					{ unit: 'function.calls', symbol: 'first' },
					{ unit: 'function.calls', symbol: 'second' }
				])
			]
		}),
		row('validator with no helper record', 'validator', [], null)
	];
	observe('explorerCategory', 'helper-contract-gates-functions', rows);
});

test('a model is a stored class or a type group, owned by its own source', () => {
	const rows: Row[] = [
		row('stored class with a table', 'model', ['src/models/Order.ts'], 'models'),
		row('interfaces only', 'model', ['src/models/Order.types.ts'], 'types'),
		row(
			'interfaces beside a stored class',
			'model',
			['src/models/Order.types.ts', 'src/models/Order.ts'],
			'models'
		),
		row(
			'interfaces beside runtime constants',
			'model',
			['src/models/Input.types.ts', 'src/models/InputValues.ts'],
			'types'
		),
		patch(row('runtime class without a table', 'model', ['src/model.client.ts'], null), {
			modelDefinitions: runtimeClass()
		}),
		patch(row('declarations from another source', 'model', ['src/a.ts'], null), {
			modelDefinitions: [modelDefinition('Other', 'src/b.ts')]
		}),
		patch(row('no model declarations', 'model', [], null), { modelDefinitions: undefined }),
		patch(row('empty declaration list', 'model', [], null), { modelDefinitions: [] })
	];
	observe('explorerCategory', 'declarations-decide-models-types', rows);
});

test('kinds that are not one of the product kinds have no category', () => {
	const rows: Row[] = [
		row('audit rule', 'audit', [], null),
		row('guide', 'guide', [], null),
		row('template', 'template', [], null),
		row('script', 'script', [], null),
		row('style sheet', 'style', [], null),
		row('entry point', 'entry', [], null),
		row('module without a helper record', 'module', [], null),
		row('unknown kind', 'never-heard-of', [], null)
	];
	observe('explorerCategory', 'unknown-kinds-unlisted', rows);
});

test('a unit says its role in priority order: types, configuration, alias, page, loader, then kind', () => {
	const rows: Row[] = [
		row('shared type declarations', 'model', ['src/models/Order.types.ts'], 'Type definitions'),
		row('route configuration', 'layout', ['src/routes/+layout.ts'], 'Route configuration'),
		row('legacy details address', 'page', [compat], 'Route alias'),
		row('rendered page', 'component', ['src/routes/o/+page.svelte'], 'Page'),
		row('route loader', 'page', ['src/routes/+page.server.ts'], 'Route loader'),
		row('layout that frames pages', 'layout', ['src/routes/+layout.svelte'], 'Layout'),
		row('stored model', 'model', ['src/models/Order.ts'], 'Model'),
		row('component', 'component', [], 'Component'),
		row('endpoint', 'api', [], 'Endpoint'),
		row('audit rule', 'audit', [], 'Audit rule'),
		row('style sheet', 'style', [], 'Style sheet')
	];
	observe('explorerRole', 'role-priority-labels', rows);
});

test('a kind with no known role is named by its own words, capitalized', () => {
	const rows: Row[] = [
		row('unmapped kind', 'never-heard-of', [], 'Never heard of'),
		row('separators become spaces', 'Snake_case kind', [], 'Snake case kind'),
		row('hyphenated words', 'Tool-Kit', [], 'Tool kit'),
		row('empty kind', '', [], 'Unit')
	];
	observe('explorerRole', 'role-unknown-kind-words', rows);
});
