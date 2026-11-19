import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import * as contract from '../../packages/reports/src/utils/explorer-ui/entityContract';
import type {
	HarnessScenario,
	HarnessUnit
} from '../../packages/reports/src/models/explorer-ui/Harness.types';

const { entityContract, humanize, requiredStates } = contract;
type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.entity-contract';
const record = (symbol: string, state: string, cases: Cases) => {
	const file = `${state}.json`;
	return recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
};

const unit = (
	patch: Partial<HarnessUnit> & Pick<HarnessUnit, 'id' | 'kind' | 'title'>
): HarnessUnit => ({
	status: 'active',
	responsibility: `${patch.title} as described.`,
	dependencies: [],
	scenarios: [],
	owns: { source: [], symbols: [] },
	contract: { inputs: [], outputs: [], errors: [] },
	runtime: { kind: 'module', targets: [] },
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
	version: 'fixture',
	...patch
});
const field = (name: string, description?: string, type = 'string') => ({
	name,
	type,
	description
});
const state = (id: string, coverage: string, units: string[] = []) => ({ id, coverage, units });
const scenario = (id: string, names: string[], states: HarnessScenario['states']) => ({
	id,
	title: id,
	kind: 'headless',
	units: names,
	states,
	viewports: [],
	tests: []
});

const filter = unit({ id: 'app.function.filter', kind: 'function', title: 'filterOrders' });
const list = unit({ id: 'app.component.list', kind: 'component', title: 'OrderList' });
const exporter = unit({ id: 'app.function.export', kind: 'function', title: 'exportOrders' });
const units = [filter, list, exporter];
const scenarios: HarnessScenario[] = [
	scenario(
		'orders-filter',
		[filter.id],
		[
			state('match', 'required', [filter.id]),
			state('list-drawn', 'required', [list.id]),
			state('no-match', 'required', [filter.id])
		]
	),
	scenario(
		'orders-search',
		[filter.id, list.id],
		[state('match', 'required', [filter.id]), state('signed-out', 'inapplicable')]
	)
];

test('Lists required states once, narrowed to the unit, and none for an unnamed unit', () => {
	const named = requiredStates(filter, scenarios, units);
	const unnamed = requiredStates(exporter, scenarios, units);
	expect([named, unnamed]).toEqual([['match', 'no-match'], []]);
	const scenarioIds = scenarios.map(({ id }) => id);
	record('requiredStates', 'required-states-narrowed-or-empty', [
		{
			name: 'shared state once; other unit and inapplicable states left out',
			input: { unit: filter.id, scenarioIds },
			output: named
		},
		{
			name: 'unit named by no scenario gets an empty list',
			input: { unit: exporter.id, scenarioIds },
			output: unnamed
		}
	]);
});

const page = unit({
	id: 'app.page.orders',
	kind: 'page',
	title: 'Orders',
	responsibility: 'Lists the orders of an account.',
	contract: {
		inputs: [field('accountId', 'The account to list.'), field('status')],
		outputs: [field('Orders', undefined, 'markup')],
		errors: []
	}
});

test('A page shows its purpose, route, inputs and markup, or Not recorded for no route', () => {
	const facts: contract.ContractFacts = { category: 'pages', appRoute: '/orders' };
	const output = entityContract(page, facts);
	expect(output).toEqual([
		{ label: 'Purpose', value: 'Lists the orders of an account.' },
		{ label: 'App route', value: '/orders' },
		{
			label: 'Inputs',
			value: 'account id, status',
			items: [
				{ name: 'account id', text: 'The account to list.' },
				{ name: 'status', text: 'No description recorded.' }
			]
		},
		{ label: 'Output', value: 'rendered markup' }
	]);
	expect(JSON.stringify(output)).not.toMatch(/src\/|\.ts\b|requiredStates|HarnessUnit|string/);
	const missing = entityContract(page, { category: 'pages', appRoute: null });
	expect(missing[1]).toEqual({ label: 'App route', value: 'Not recorded' });
	record('entityContract', 'page-rows-show-purpose-route-and-markup', [
		{
			name: 'page rows: described and undescribed inputs, no files or types',
			input: { unit: page.id, facts },
			output
		},
		{
			name: 'null route reads Not recorded',
			input: { unit: page.id, facts: { category: 'pages', appRoute: null } },
			output: missing
		}
	]);
});

test('Each category shows its own rows, and failures or running targets only where declared', () => {
	const config = unit({
		id: 'app.config.settings',
		kind: 'config',
		title: 'OrderSettings',
		contract: { inputs: [], outputs: [field('pageSize'), field('sort')], errors: [field('Bad')] }
	});
	const targets = [
		{ kind: 'wasm', entry: 'a.wasm' },
		{ kind: 'process', entry: 'a' }
	];
	const service = unit({
		id: 'app.service.store',
		kind: 'service',
		title: 'OrderStore',
		runtime: { kind: 'module', targets },
		contract: { inputs: [field('accountId')], outputs: [field('orders')], errors: [] }
	});
	const fn = unit({
		id: 'app.function.filter',
		kind: 'function',
		title: 'filterOrders',
		contract: {
			inputs: [field('searchText')],
			outputs: [field('orders')],
			errors: [field('NoMatch')]
		}
	});
	const cases = [
		{ name: 'config shows purpose and what it provides', unit: config, category: 'configs' },
		{ name: 'service shows inputs, output and how it runs', unit: service, category: 'services' },
		{ name: 'function shows inputs, output and failures', unit: fn, category: 'functions' }
	] as const;
	const outputs = cases.map(({ unit: item, category }) => entityContract(item, { category }));
	expect(outputs[0].map(({ label }) => label)).toEqual(['Purpose', 'Provides']);
	expect(outputs[0][1]).toEqual({ label: 'Provides', value: 'page size, sort' });
	expect(outputs[1][2]).toEqual({ label: 'Runs as', value: 'Wasm, Native process' });
	expect(outputs[2].map(({ label }) => label)).toEqual(['Inputs', 'Output', 'Fails with']);
	record(
		'entityContract',
		'category-rows-select-labels',
		cases.map(({ name, unit: item, category }, index) => ({
			name,
			input: { unit: item.id, category },
			output: outputs[index]
		}))
	);
});

test('Explicit empty contracts read None or Nothing declared', () => {
	const bareConfig = unit({ id: 'app.config.settings', kind: 'config', title: 'OrderSettings' });
	const functionRows = entityContract(exporter, { category: 'functions' });
	const componentRows = entityContract(exporter, { category: 'components' });
	const configRows = entityContract(bareConfig, { category: 'configs' });
	expect(functionRows).toEqual([
		{ label: 'Inputs', value: 'None' },
		{ label: 'Output', value: 'Nothing declared' }
	]);
	expect(componentRows).toEqual([{ label: 'Props', value: 'None' }]);
	expect(configRows[1]).toEqual({ label: 'Provides', value: 'Nothing declared' });
	record('entityContract', 'empty-contract-reads-none', [
		{
			name: 'function with no inputs or outputs',
			input: { unit: exporter.id },
			output: functionRows
		},
		{
			name: 'component with no inputs',
			input: { unit: exporter.id, category: 'components' },
			output: componentRows
		},
		{ name: 'config with no outputs', input: { unit: bareConfig.id }, output: configRows }
	]);
});

test('Identifiers become lowercase words, and empty or spaced text is kept as given', () => {
	const pairs: Array<[string, string]> = [
		['pageSize', 'page size'],
		['HTTPServer', 'http server'],
		['orderID', 'order id'],
		['order_item.total', 'order item total'],
		[' order-item_count.total ', 'order item count total'],
		['search  text', 'search  text'],
		['', '']
	];
	const output = pairs.map(([name]) => humanize(name));
	expect(output).toEqual(pairs.map(([, words]) => words));
	record(
		'humanize',
		'identifiers-become-lowercase-words',
		pairs.map(([name], index) => ({
			name: `identifier ${name}`,
			input: { name },
			output: output[index]
		}))
	);
});
