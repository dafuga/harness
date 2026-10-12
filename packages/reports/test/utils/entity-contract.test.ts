import { expect, test } from 'vitest';
import { entityContract, humanize, requiredStates } from '../../src/utils/entityContract';
import { ids, scenarios, units } from '../entityUnits';

const find = (id: string) => units.find((unit) => unit.id === id)!;
const row = (rows: Array<{ label: string; value: string }>, label: string) =>
	rows.find((item) => item.label === label)?.value;

test('a contract reads as inputs and output in plain words, without the symbol that owns them', () => {
	const rows = entityContract(find(ids.filter), { category: 'functions' });
	expect(row(rows, 'Inputs')).toBe('orders, search text');
	expect(row(rows, 'Output')).toBe('matching orders');
	expect(row(rows, 'Fails with')).toBe('Nothing declared');
	expect(JSON.stringify(rows)).not.toMatch(/filterOrders|src\/|\.ts/);
});

test('a page contract has its purpose, its web address and the states it must be proven in', () => {
	const states = requiredStates(find(ids.page), scenarios);
	const rows = entityContract(find(ids.page), { category: 'pages', appRoute: '/orders', states });
	expect(rows.map((item) => item.label)).toEqual([
		'Purpose',
		'App route',
		'Inputs',
		'Output',
		'Required states'
	]);
	expect(row(rows, 'Purpose')).toBe('Lists the orders of an account.');
	expect(row(rows, 'App route')).toBe('/orders');
	expect(row(rows, 'Required states')).toBe('default, empty');
});

test('a page whose address is not recorded says so instead of showing a file', () => {
	const rows = entityContract(find(ids.page), { category: 'pages', appRoute: null, states: [] });
	expect(row(rows, 'App route')).toBe('Not recorded');
	expect(row(rows, 'Required states')).toBe('None declared');
});

test('a config says what it provides and a service how it runs', () => {
	const config = entityContract(find(ids.settings), { category: 'configs' });
	expect(row(config, 'Provides')).toBe('page size, default sort');
	expect(row(config, 'Inputs')).toBeUndefined();
	const service = entityContract(find(ids.store), { category: 'services' });
	expect(row(service, 'Runs as')).toBe('Module, Wasm, Native process');
});

test('names of any casing become words, and required states leave out the unproven ones', () => {
	expect(humanize('searchText')).toBe('search text');
	expect(humanize('page_size')).toBe('page size');
	expect(humanize('on-select')).toBe('on select');
	expect(humanize('HTTPStatus')).toBe('http status');
	expect(requiredStates(find(ids.filter), scenarios)).toEqual(['match', 'no-match']);
});

test('what a page or a component draws is called rendered markup, not by the name of its file', () => {
	const page = units.find((unit) => unit.id === ids.page)!;
	const drawn = {
		...page,
		contract: { ...page.contract, outputs: [{ name: '+page', type: 'markup' }] }
	};
	const rows = entityContract(drawn, { category: 'pages', appRoute: '/orders' });
	expect(rows.find((item) => item.label === 'Output')?.value).toBe('rendered markup');
	const list = units.find((unit) => unit.id === ids.list)!;
	const named = {
		...list,
		contract: { ...list.contract, outputs: [{ name: 'OrderList', type: 'markup' }] }
	};
	const told = entityContract(named, { category: 'components' });
	expect(told.find((item) => item.label === 'Output')?.value).toBe('rendered markup');
	// A contract that declares what is drawn keeps the name it was given.
	const declared = {
		...list,
		contract: { ...list.contract, outputs: [{ name: 'OrderList.searchableList', type: 'markup' }] }
	};
	expect(row(entityContract(declared, { category: 'components' }), 'Output')).toBe(
		'searchable list'
	);
});

test('a declared contract says what each item is, and a derived one only names it', () => {
	const declared = {
		...find(ids.page),
		contract: {
			inputs: [
				{ name: 'branch', type: 'string', description: 'The branch, as one path segment.' },
				{ name: 'tab', type: 'string' }
			],
			outputs: [{ name: '+page', type: 'markup', description: 'The page with its verdict.' }],
			errors: [{ name: 'not-at-revision', type: 'notice', description: 'A missing page is said.' }]
		}
	};
	const rows = entityContract(declared, { category: 'pages', appRoute: '/orders' });
	const of = (label: string) => rows.find((item) => item.label === label);
	expect(of('Inputs')).toEqual({
		label: 'Inputs',
		value: 'branch, tab',
		items: [{ name: 'branch', text: 'The branch, as one path segment.' }]
	});
	expect(of('Output')?.items).toEqual([
		{ name: 'rendered markup', text: 'The page with its verdict.' }
	]);
	// What a page does when it cannot show what was asked is part of its contract once declared.
	expect(of('Fails with')).toEqual({
		label: 'Fails with',
		value: 'not at revision',
		items: [{ name: 'not at revision', text: 'A missing page is said.' }]
	});
	const derived = entityContract(find(ids.filter), { category: 'functions' });
	expect(derived.every((item) => item.items === undefined)).toBe(true);
});
