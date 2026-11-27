import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { explorerAppRoute, explorerName } from '../../src/utils/explorer-ui/explorerName';
import type { Named } from '../../src/utils/explorer-ui/explorerName.types';
import type { Cases, Route } from './reports.function.explorer-name.test.types';
const unitId = 'reports.function.explorer-name';
const record = (symbol: string, state: string, cases: Cases) => {
	const file = `${state}.json`;
	return recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
};

const owns = (source: string[], symbols: string[] = []) => ({ source, symbols });
const unit = (id: string, kind: Named['kind'], title: string, source?: ReturnType<typeof owns>) =>
	({ id, kind, title, ...(source ? { owns: source } : {}) }) as Named;
const route = (kind: Route['kind'], title: string, source: string[] = []): Route => ({
	kind,
	title,
	owns: owns(source)
});

test('Owned code identity names a unit before its descriptive title', () => {
	const cases = [
		{
			name: 'declared identifier without owned source',
			input: unit('function.console-route', 'function', 'consoleRoute'),
			output: 'consoleRoute'
		},
		{
			name: 'owned symbol wins over a descriptive title',
			input: unit(
				'app.service.orders',
				'service',
				'A descriptive title for orders',
				owns(['src/lib/checkout/CheckoutService.ts'], ['CheckoutOptions', 'CheckoutService'])
			),
			output: 'CheckoutService'
		},
		{
			name: 'explorer name keeps its own exported symbol',
			input: unit(
				'reports.function.explorer-name',
				'function',
				'Readable entity names',
				owns(
					['packages/reports/src/utils/explorer-ui/explorerName.ts'],
					['explorerName', 'explorerAppRoute']
				)
			),
			output: 'explorerName'
		},
		{
			name: 'owned module stem names a function without symbols',
			input: unit(
				'function.format',
				'function',
				'Format duration',
				owns(['src/utils/formatDuration.ts'])
			),
			output: 'formatDuration'
		}
	];
	const outputs = cases.map(({ input }) => explorerName(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	record(
		'explorerName',
		'code-identity-wins',
		cases.map((item, index) => ({ ...item, output: outputs[index] }))
	);
});

test('Written titles, endpoint paths and route screens read as labels', () => {
	const cases = [
		{
			name: 'page title a person wrote is kept',
			input: unit('reports.page.orders', 'page', 'Order history'),
			output: 'Order history'
		},
		{
			name: 'surrounding spaces are trimmed from a written title',
			input: unit('component.cart', 'component', '  Cart summary (mini)  '),
			output: 'Cart summary (mini)'
		},
		{
			name: 'endpoint path is returned unchanged',
			input: unit('reports.endpoint.records', 'endpoint', '/api/v1/records'),
			output: '/api/v1/records'
		},
		{
			name: 'route screen after a parameter names the screen',
			input: unit('reports.page.function-details', 'page', '/functions/[entity]/details'),
			output: 'Details'
		},
		{
			name: 'singular collection before parameter with a screen',
			input: unit(
				'reports.page.function-details-nested',
				'page',
				'/harness/branch/[branch]/[...at]/functions/[entity]/details'
			),
			output: 'Function details'
		},
		{
			name: 'known initials are uppercased in a route label',
			input: unit('reports.page.cli-json', 'page', '/cli/[id]/json'),
			output: 'JSON'
		}
	];
	const outputs = cases.map(({ input }) => explorerName(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	record(
		'explorerName',
		'written-titles-and-route-screens',
		cases.map((item, index) => ({ ...item, output: outputs[index] }))
	);
});

test('Identifier fallbacks and unknown units read as words or Unnamed', () => {
	const cases = [
		{
			name: 'page file title falls back to the final id segment',
			input: unit('page.titles', 'page', '+page'),
			output: 'Titles'
		},
		{
			name: 'dotted title falls back to the final id segment',
			input: unit('function.slugify', 'function', 'function.slugify'),
			output: 'Slugify'
		},
		{
			name: 'style file title splits its id words',
			input: unit('reports.style.base-2', 'style', 'base-2.css'),
			output: 'Base 2'
		},
		{
			name: 'empty title and id give Unnamed',
			input: unit('', 'function', ''),
			output: 'Unnamed'
		}
	];
	const outputs = cases.map(({ input }) => explorerName(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	record(
		'explorerName',
		'id-and-unnamed-fallbacks',
		cases.map((item, index) => ({ ...item, output: outputs[index] }))
	);
});

test('Pages and layouts name an address, and other kinds have none', () => {
	const cases = [
		{
			name: 'slash title is the page address',
			input: route('page', '/harness/[...view]'),
			output: '/harness/[...view]'
		},
		{
			name: 'owned page file gives its route address',
			input: route('page', '+page', [
				'src/routes/titles/+page.server.ts',
				'src/routes/titles/+page.svelte'
			]),
			output: '/titles'
		},
		{
			name: 'root route file maps to slash',
			input: route('page', '+page', ['packages/reports/src/routes/+page.svelte']),
			output: '/'
		},
		{
			name: 'layout with an owned route page gives its address',
			input: route('layout', 'Shell', ['src/routes/shell/+page.svelte']),
			output: '/shell'
		},
		{
			name: 'layout with only a layout file has no address',
			input: route('layout', '+layout', ['src/routes/orders/+layout.svelte']),
			output: null
		},
		{
			name: 'function is not a page and has no address',
			input: route('function', '/not/a/page'),
			output: null
		},
		{
			name: 'page with no route file and no slash title',
			input: route('page', 'Odd'),
			output: null
		}
	];
	const outputs = cases.map(({ input }) => explorerAppRoute(input));
	expect(outputs).toEqual(cases.map(({ output }) => output));
	record(
		'explorerAppRoute',
		'page-and-layout-addresses',
		cases.map((item, index) => ({ ...item, output: outputs[index] }))
	);
});
