import { test } from 'vitest';
import { mapContracts } from '../../src/commands/development-tooling/contracts-command/mapContracts';
import type {
	ContractEntry,
	ContractMap
} from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { contractUnit } from '../support/contractsProject';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * mapContracts stores nothing, so no temporary directory is needed: the examples pass it catalog
 * entries built in memory, with manifests parsed by the schema the catalog reader uses. Each map is
 * compared by the ids its lists hold, beside its query label and its unresolved ids.
 */

/** A catalog entry as readContractCatalog builds one, with the units its manifest depends on. */
function entry(id: string, dependsOn: string[] = []): ContractEntry {
	const manifest = contractUnit(id, `src/${id}.ts`, dependsOn);
	return {
		id,
		kind: manifest.kind,
		title: manifest.title,
		path: manifest.owns.source[0],
		contractPath: `specification/units/${id}.json`,
		responsibility: manifest.responsibility,
		manifest,
		states: []
	};
}

const idsOf = (list: Array<{ id: string }>) => list.map((item) => item.id);
const unitsOf = (item: ContractEntry) => item.manifest.dependencies.map((edge) => edge.unit);

/** The fields a reader compares: the query label, the ids of each list and the unresolved ids. */
function shapeOf(map: ContractMap) {
	return {
		query: map.query,
		matches: idsOf(map.matches),
		dependencies: idsOf(map.dependencies),
		dependents: idsOf(map.dependents),
		unresolved: map.unresolved
	};
}

/** Calls mapContracts and keeps the call as an example, with the catalog edges it was given. */
function callMap(entries: ContractEntry[], matches: ContractEntry[], query: string, depth: number) {
	const map = mapContracts(entries, matches, query, depth);
	const edges = entries.map((item) => [item.id, unitsOf(item)]);
	const input = { catalog: Object.fromEntries(edges), matches: idsOf(matches), query, depth };
	return { map, example: { input, output: shapeOf(map) } };
}

/** The name and message of the error a call throws, or undefined when the call returns. */
function thrownBy(run: () => unknown): { name: string; message: string } | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		if (error instanceof Error) return { name: error.name, message: error.message };
		throw error;
	}
}

/** Throws an error with the message, for an accessor or iterator that refuses a caller. */
function refuse(message: string): never {
	throw new Error(message);
}

test('mapContracts walked dependencies and dependents by depth', () => {
	const source = entry('model.source');
	const tokens = entry('model.tokens', ['model.source']);
	const lexer = entry('service.lexer', ['model.tokens']);
	const parser = entry('service.parser', ['service.lexer', 'model.tokens']);
	const render = entry('command.render', ['service.parser']);
	const check = entry('command.check', ['command.render', 'service.parser']);
	const ship = entry('workflow.ship', ['command.check']);
	const catalog = [source, tokens, lexer, parser, render, check, ship];
	const none = callMap(catalog, [parser], 'service.parser', 0);
	const one = callMap(catalog, [parser], 'service.parser', 1);
	const two = callMap(catalog, [parser], 'service.parser', 2);
	const pair = callMap(catalog, [parser, lexer], 'src/services/parser.ts', 1);
	expect(none.example.output).toEqual({
		query: 'service.parser',
		matches: ['service.parser'],
		dependencies: [],
		dependents: [],
		unresolved: []
	});
	expect(idsOf(one.map.dependencies)).toEqual(['model.tokens', 'service.lexer']);
	expect(idsOf(one.map.dependents)).toEqual(['command.check', 'command.render']);
	expect(idsOf(two.map.dependencies)).toEqual(['model.source', 'model.tokens', 'service.lexer']);
	expect(idsOf(two.map.dependents)).toEqual(['command.check', 'command.render', 'workflow.ship']);
	expect(pair.map.query).toBe('src/services/parser.ts');
	expect(idsOf(pair.map.matches)).toEqual(['service.parser', 'service.lexer']);
	expect(idsOf(pair.map.dependencies)).toEqual(['model.tokens']);
	expect(idsOf(pair.map.dependents)).toEqual(['command.check', 'command.render']);
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-map-contracts',
			symbol: 'mapContracts',
			state: 'mapcontracts-walked-dependencies-and-dependents-by-depth',
			evidence: 'examples-cases',
			file: 'mapcontracts-walked-dependencies-and-dependents-by-depth.json'
		},
		[
			{ name: 'depth 0 returns only the matched root', ...none.example },
			{ name: 'depth 1 lists the direct dependencies and dependents', ...one.example },
			{ name: 'depth 2 reaches the next hop in each direction', ...two.example },
			{ name: 'a path query with two roots keeps the second root a match', ...pair.example }
		]
	);
});

test('mapContracts listed missing dependency ids as unresolved', () => {
	const invoice = entry('model.invoice', ['model.legacy-currency']);
	const billing = entry('service.billing', ['model.invoice', 'service.retired-tax']);
	const view = entry('command.invoice-view', ['service.billing']);
	const catalog = [invoice, billing, view];
	const none = callMap(catalog, [billing], 'service.billing', 0);
	const one = callMap(catalog, [billing], 'service.billing', 1);
	const two = callMap(catalog, [billing], 'service.billing', 2);
	expect(none.map.unresolved).toEqual([]);
	expect(idsOf(one.map.dependencies)).toEqual(['model.invoice']);
	expect(idsOf(one.map.dependents)).toEqual(['command.invoice-view']);
	expect(one.map.unresolved).toEqual(['service.retired-tax']);
	expect(idsOf(two.map.dependencies)).toEqual(['model.invoice']);
	expect(two.map.unresolved).toEqual(['model.legacy-currency', 'service.retired-tax']);
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-map-contracts',
			symbol: 'mapContracts',
			state: 'mapcontracts-listed-missing-dependency-ids-as-unresolved',
			evidence: 'examples-cases',
			file: 'mapcontracts-listed-missing-dependency-ids-as-unresolved.json'
		},
		[
			{ name: 'depth 0 reports nothing as unresolved', ...none.example },
			{ name: 'depth 1 lists the missing direct dependency as unresolved only', ...one.example },
			{ name: 'depth 2 reports a missing dependency found one hop further', ...two.example }
		]
	);
});

test('mapContracts bounded cycles and expanded repeated edges once', () => {
	const ringA = entry('service.ring-a', ['service.ring-b', 'service.ring-b']);
	const ringB = entry('service.ring-b', ['service.ring-c']);
	const ringC = entry('service.ring-c', ['service.ring-a']);
	const fanout = entry('command.fanout', ['service.ring-a', 'service.ring-a']);
	const catalog = [ringA, ringB, ringC, fanout];
	const one = callMap(catalog, [ringA], 'service.ring-a', 1);
	const deep = callMap(catalog, [ringA], 'service.ring-a', 10);
	expect(idsOf(one.map.dependencies)).toEqual(['service.ring-b']);
	expect(idsOf(one.map.dependents)).toEqual(['command.fanout', 'service.ring-c']);
	expect(idsOf(deep.map.dependencies)).toEqual(['service.ring-b', 'service.ring-c']);
	expect(idsOf(deep.map.dependents)).toEqual([
		'command.fanout',
		'service.ring-b',
		'service.ring-c'
	]);
	expect(idsOf(deep.map.matches)).toEqual(['service.ring-a']);
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-map-contracts',
			symbol: 'mapContracts',
			state: 'mapcontracts-bounded-cycles-and-expanded-repeated-edges-once',
			evidence: 'examples-cases',
			file: 'mapcontracts-bounded-cycles-and-expanded-repeated-edges-once.json'
		},
		[
			{ name: 'depth 1 lists a doubled edge once and leaves out the root', ...one.example },
			{ name: 'depth 10 ends the cycle and leaves the root out of both lists', ...deep.example }
		]
	);
});

test('mapContracts propagated getter, iterator and species errors', () => {
	const parser = entry('service.parser', ['model.tokens']);
	const unreadable = entry('service.unreadable');
	Object.defineProperty(unreadable, 'manifest', { get: () => refuse('manifest unreadable') });
	const iterated = [parser];
	Object.defineProperty(iterated, Symbol.iterator, { value: () => refuse('iterator refused') });
	const species = [parser];
	Object.defineProperty(species, 'constructor', {
		value: {
			get [Symbol.species]() {
				return refuse('species refused');
			}
		}
	});
	const call = { matches: ['service.parser'], depth: 1 };
	const getter = thrownBy(() => mapContracts([parser, unreadable], [parser], 'service.parser', 1));
	const iterator = thrownBy(() => mapContracts(iterated, [parser], 'service.parser', 1));
	const speciesError = thrownBy(() => mapContracts([parser], species, 'service.parser', 1));
	expect(getter).toEqual({ name: 'Error', message: 'manifest unreadable' });
	expect(iterator).toEqual({ name: 'Error', message: 'iterator refused' });
	expect(speciesError).toEqual({ name: 'Error', message: 'species refused' });
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-map-contracts',
			symbol: 'mapContracts',
			state: 'mapcontracts-propagated-getter-iterator-and-species-errors',
			evidence: 'examples-cases',
			file: 'mapcontracts-propagated-getter-iterator-and-species-errors.json'
		},
		[
			{
				name: 'a manifest getter of a second entry throws',
				input: { accessor: 'manifest getter', ...call },
				error: getter
			},
			{
				name: 'the entries iterator throws',
				input: { accessor: 'entries iterator', ...call },
				error: iterator
			},
			{
				name: 'the matches species getter throws',
				input: { accessor: 'matches species getter', ...call },
				error: speciesError
			}
		]
	);
});
