import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { helperConsumers } from '../../src/services/explorer-ui/revision-detail-service/helperConsumers';
import type { Unit } from '../../src/services/explorer-ui/revision-detail-service/helperConsumers.types';
import { serviceClasses } from '../../src/services/explorer-ui/revision-detail-service/serviceClasses';
import type { Facts, Lookup } from '../../src/services/explorer-ui/revision-detail-service/serviceClasses.types';
import type { HelperTree } from '../../src/utils/explorer-ui/helperConsumers';

const helperMeta = {
	unitId: 'function.helper-consumers',
	symbol: 'helperConsumers',
	evidence: 'examples-cases'
};

const serviceMeta = {
	unitId: 'function.helper-consumers',
	symbol: 'serviceClasses',
	evidence: 'examples-cases'
};

function unitOf(id: string, source: string[] = []): Unit {
	return {
		id,
		kind: 'function',
		status: 'active',
		title: id,
		responsibility: 'Fixture unit for example tests.',
		dependencies: [],
		scenarios: [],
		serviceExports: [],
		helpers: [],
		owns: { source, symbols: [] },
		runtime: { kind: 'module', targets: [] }
	} as unknown as Unit;
}

function treeOf(list: () => Promise<unknown>): HelperTree {
	return {
		read: async () => {
			throw new Error('no config file in fixture');
		},
		list: list as HelperTree['list']
	};
}

function summary(units: Unit[]) {
	return units.map((unit) => {
		const { id, serviceConsumers, serviceClasses: classes } = unit as unknown as Record<
			string,
			unknown
		>;
		return { id, serviceConsumers, serviceClasses: classes };
	});
}

const emptyLookup: Lookup = {
	users: new Map(),
	target: () => undefined,
	reference: () => undefined
};

test('Rejects when the tree list call rejects', async () => {
	const tree = treeOf(async () => {
		throw new Error('listing failed');
	});
	await expect(helperConsumers(tree, [unitOf('function.alpha')])).rejects.toThrow(
		'listing failed'
	);
	recordExampleCases(
		{ ...helperMeta, state: 'rejects-when-the-tree-list-call-rejects', file: 'rejects-when-the-tree-list-call-rejects.json' },
		[
			{
				name: 'tree list rejects with a listing error',
				input: { units: ['function.alpha'], list: 'rejects' },
				error: 'listing failed'
			}
		]
	);
});

test('Rejects with a TypeError when the tree list yields null', async () => {
	const tree = treeOf(async () => null);
	await expect(helperConsumers(tree, [unitOf('function.alpha')])).rejects.toBeInstanceOf(
		TypeError
	);
	recordExampleCases(
		{
			...helperMeta,
			state: 'rejects-with-a-typeerror-when-the-tree-list-yields-null',
			file: 'rejects-with-a-typeerror-when-the-tree-list-yields-null.json'
		},
		[
			{
				name: 'tree list resolves to null',
				input: { units: ['function.alpha'], list: null },
				error: 'TypeError'
			}
		]
	);
});

test('Leaves an active unit without service exports empty', async () => {
	const unit = unitOf('function.alpha');
	await expect(helperConsumers(treeOf(async () => []), [unit])).resolves.toBeUndefined();
	expect(summary([unit])).toEqual([
		{ id: 'function.alpha', serviceConsumers: [], serviceClasses: [] }
	]);
	recordExampleCases(
		{
			...helperMeta,
			state: 'leaves-an-active-unit-without-service-exports-empty',
			file: 'leaves-an-active-unit-without-service-exports-empty.json'
		},
		[
			{
				name: 'active unit with no owned source and no exports',
				input: { id: 'function.alpha', owns: [], list: [] },
				output: { id: 'function.alpha', serviceConsumers: [], serviceClasses: [] }
			}
		]
	);
});

test('Empties service classes for a unit without exports', () => {
	const unit = unitOf('function.alpha');
	const facts: Facts = new Map();
	const result = serviceClasses([unit], facts, emptyLookup);
	expect(result).toBeUndefined();
	expect(summary([unit])).toEqual([
		{ id: 'function.alpha', serviceConsumers: undefined, serviceClasses: [] }
	]);
	recordExampleCases(
		{
			...serviceMeta,
			state: 'empties-service-classes-for-a-unit-without-exports',
			file: 'empties-service-classes-for-a-unit-without-exports.json'
		},
		[
			{
				name: 'unit with no service exports and no facts',
				input: { id: 'function.alpha', serviceExports: [], facts: 0 },
				output: { id: 'function.alpha', serviceClasses: [] }
			}
		]
	);
});
