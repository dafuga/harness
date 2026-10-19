import { expect, test } from 'vitest';
import type { HarnessScenario, HarnessUnit } from '../../src/models/Harness.types';
import {
	entityContract,
	requiredStates
} from '../../src/components/harness/entity-sections/entityContract';
import { humanize } from '../../src/utils/entityContract';
import { scenarioFor } from '../../src/utils/explorerState';
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
	const states = requiredStates(find(ids.page), scenarios, units);
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
	expect(requiredStates(find(ids.filter), scenarios, units)).toEqual(['match', 'no-match']);
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
		items: [
			{ name: 'branch', text: 'The branch, as one path segment.' },
			{ name: 'tab', text: 'No description recorded.' }
		]
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

test('contract fields preserve admitted iterators, species and getter reads', () => {
	let descriptions = 0;
	let species = 0;
	const fields = [
		{
			name: 'searchText',
			type: 'string',
			get description() {
				descriptions++;
				return 'Words to find.';
			}
		},
		{ name: 'pageSize', type: 'number' }
	];
	Object.defineProperty(fields, Symbol.iterator, {
		value: () => {
			throw new Error('Must not iterate');
		}
	});
	Object.defineProperty(fields, 'some', {
		value: () => {
			throw new Error('New array operation');
		}
	});
	Object.defineProperty(fields, 'constructor', {
		value: {
			get [Symbol.species]() {
				species++;
				return Array;
			}
		}
	});
	const original = find(ids.filter);
	const unit = { ...original, contract: { ...original.contract, inputs: fields } };
	const inputs = entityContract(unit, { category: 'functions' }).find(
		(item) => item.label === 'Inputs'
	);
	expect(inputs).toMatchObject({
		value: 'search text, page size',
		items: [
			{ name: 'search text', text: 'Words to find.' },
			{ name: 'page size', text: 'No description recorded.' }
		]
	});
	expect(descriptions).toBe(2);
	expect(species).toBe(2);
});

/** A unit of a small registry: what it uses is all that matters of it here. */
const made = (id: string, uses: string[] = []): HarnessUnit => ({
	...find(ids.page),
	id,
	dependencies: uses.map((unit) => ({ unit, via: 'import' }))
});
// Three pages: two are made of one shared component, and an endpoint is behind none of them.
const registry = [
	made('page.a', ['shared']),
	made('page.b', ['shared']),
	made('page.c'),
	made('shared', ['helper']),
	made('helper'),
	made('endpoint')
];
const screens: HarnessScenario = {
	...scenarios[0],
	id: 'screens',
	units: registry.map((unit) => unit.id),
	states: [
		{ id: 'a', coverage: 'required', units: ['page.a'] },
		{ id: 'a-empty', coverage: 'required', units: ['page.a'] },
		{ id: 'a-denied', coverage: 'inapplicable', reason: 'no sign-in', units: ['page.a'] },
		{ id: 'b', coverage: 'required', units: ['page.b'] },
		{ id: 'c', coverage: 'required', units: ['page.c'] }
	]
};
const required = (id: string, units = registry) =>
	requiredStates(units.find((unit) => unit.id === id) ?? made(id), [screens], units);

test('a page that states name is required in those states, and in no state of another page', () => {
	expect(required('page.a')).toEqual(['a', 'a-empty']);
	expect(required('page.c')).toEqual(['c']);
});

test('a shared component is required in the states of every page that is made of it', () => {
	expect(required('shared')).toEqual(['a', 'a-empty', 'b']);
	// Through what uses what uses it, to any depth.
	expect(required('helper')).toEqual(['a', 'a-empty', 'b']);
});

test('a unit that nothing named is made of stays required in every state, as its proof keeps it', () => {
	expect(required('endpoint')).toEqual(['a', 'a-empty', 'b', 'c']);
	// A registry that holds no units cannot say what is made of what: nothing is narrowed by it.
	expect(required('shared', [])).toEqual(['a', 'a-empty', 'b', 'c']);
});

test('the states listed are the required ones of exactly what the proof judges a unit in', () => {
	for (const unit of registry) {
		const judged = scenarioFor(screens, unit.id, registry)
			.states.filter((state) => state.coverage === 'required')
			.map((state) => state.id);
		expect(requiredStates(unit, [screens], registry), unit.id).toEqual(judged);
	}
});
