import { contract } from './command.development-tooling-contracts-command-contract-selection.fixture';
import type { ExampleCase } from './command.development-tooling-contracts-command-contract-selection.test.types';
import { test } from 'vitest';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';

import * as selection from '../../src/commands/development-tooling/contracts-command/contractSelection';
import type * as contracts from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const UNIT = 'command.development-tooling-contracts-command-contract-selection';
const ROOT = '/work/harness-example';
const OUTSIDE = 'Contract paths must stay within the project root; target is outside it.';
const REFUSED = { name: 'ExpectedCliError', message: OUTSIDE };

const alpha = contract('command.alpha', ['src/alpha/command.ts'], 'Alpha command');
const beta = contract('model.beta', ['src/alpha/beta.ts', 'src/alpha/schema.ts'], 'Beta model');
const gamma = contract('command.gamma', ['src/gamma/command.ts'], 'Gamma command', 'retired');
const delta = contract('function.delta', ['src/alphabet/helpers.ts'], 'Delta helpers');
const docs = contract('docs', ['src/docs/index.ts'], 'Documentation index');
const guide = contract('command.guide', ['docs/guide.ts'], 'Guide command');
/** Input order is deliberately not id order: selection and filtering must keep it. */
const catalog = [beta, docs, alpha, guide, delta, gamma];
const brief = catalog.map(({ id, kind, contractPath, manifest }) => ({
	id,
	kind,
	contractPath,
	status: manifest.status,
	source: manifest.owns.source
}));

/** One call as a recorded case: the value it returned, or the error it threw. */
function observe(name: string, input: unknown, call: () => unknown): ExampleCase {
	try {
		return { name, input, output: call() };
	} catch (error) {
		const { name: kind, message } = error as Error;
		return { name, input, error: { name: kind, message } };
	}
}

/** Each case's output, or its error, in case order. */
function outcomes(cases: ExampleCase[]): unknown[] {
	return cases.map((item) => ('error' in item ? item.error : item.output));
}

const ids = (entries: contracts.ContractEntry[]) => entries.map((entry) => entry.id);

test('contractPath normalizes paths and rejects outside targets', () => {
	const normal = (name: string, query: string) =>
		observe(name, { root: ROOT, query }, () => selection.contractPath(ROOT, query));
	const cases = [
		normal('a root-relative file path', 'src/alpha/command.ts'),
		normal('an absolute folder with a trailing slash', `${ROOT}/src/alpha/`),
		normal('dot segments that stay inside the root', 'src/alpha/../beta.ts'),
		normal('the project root itself', '.'),
		normal('a sibling folder that shares the root name', '../harness-example-old/src/alpha.ts'),
		normal('an absolute path outside the root', '/work/elsewhere/src/alpha.ts'),
		normal('the parent folder of the root', '..')
	];
	const expected = [
		'src/alpha/command.ts',
		'src/alpha',
		'src/beta.ts',
		'',
		REFUSED,
		REFUSED,
		REFUSED
	];
	expect(outcomes(cases)).toEqual(expected);
	expect(() => selection.contractPath(ROOT, '../old/x.ts')).toThrow(ExpectedCliError);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'contractPath',
			state: 'contractpath-normalizes-paths-and-rejects-outside-targets',
			evidence: 'examples-cases',
			file: 'contractpath-normalizes-paths-and-rejects-outside-targets.json'
		},
		cases
	);
});

test('selectContracts prefers an exact id, then owned paths', () => {
	const select = (name: string, target: string) =>
		observe(name, { target, root: ROOT, catalog: brief }, () =>
			ids(selection.selectContracts(catalog, target, ROOT))
		);
	const cases = [
		select('an exact unit id', 'command.alpha'),
		select('an id that is also a folder name', 'docs'),
		select('a folder, matched on slash boundaries', 'src/alpha'),
		select('a contract file path', 'specification/units/model.beta.json'),
		select('an owned source file', 'src/gamma/command.ts'),
		select('the project root, which matches every owner', '.'),
		select('a path with no owner', 'src/unowned/notes.md'),
		select('a path outside the project root', '../outside/src/alpha/command.ts')
	];
	const expected = [
		['command.alpha'],
		['docs'],
		['model.beta', 'command.alpha'],
		['model.beta'],
		['command.gamma'],
		['model.beta', 'docs', 'command.alpha', 'command.guide', 'function.delta', 'command.gamma'],
		[],
		REFUSED
	];
	expect(outcomes(cases)).toEqual(expected);
	expect(selection.selectContracts(catalog, 'docs', ROOT)[0]).toBe(docs);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'selectContracts',
			state: 'selectcontracts-prefers-an-exact-id-then-owned-paths',
			evidence: 'examples-cases',
			file: 'selectcontracts-prefers-an-exact-id-then-owned-paths.json'
		},
		cases
	);
});

test('filterContracts combines status, kind, area and folder', () => {
	const filter = (name: string, options: contracts.ContractOptions) =>
		observe(name, { catalog: brief, options }, () =>
			ids(selection.filterContracts(catalog, options))
		);
	const cases = [
		filter('no filters keeps active records in input order', {}),
		filter('includeRetired admits the retired record', { includeRetired: true }),
		filter('kind with includeRetired', { kind: 'command', includeRetired: true }),
		filter('area matches an id category', { area: 'command' }),
		filter('area matches a source path segment', { area: 'alpha' }),
		filter('a folder matches on slash boundaries', { root: ROOT, folder: 'src/alpha' }),
		filter('a folder resolves from the current directory', { folder: 'src/alpha' }),
		filter('a folder outside the root is rejected', { root: ROOT, folder: '../elsewhere' }),
		filter('all four filters combine', {
			kind: 'model',
			area: 'alpha',
			folder: 'src/alpha',
			includeRetired: true
		})
	];
	const expected = [
		['model.beta', 'docs', 'command.alpha', 'command.guide', 'function.delta'],
		['model.beta', 'docs', 'command.alpha', 'command.guide', 'function.delta', 'command.gamma'],
		['command.alpha', 'command.guide', 'command.gamma'],
		['command.alpha', 'command.guide'],
		['model.beta', 'command.alpha'],
		['model.beta', 'command.alpha'],
		['model.beta', 'command.alpha'],
		REFUSED,
		['model.beta']
	];
	expect(outcomes(cases)).toEqual(expected);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'filterContracts',
			state: 'filtercontracts-combines-status-kind-area-and-folder',
			evidence: 'examples-cases',
			file: 'filtercontracts-combines-status-kind-area-and-folder.json'
		},
		cases
	);
});

test('contractSummary projects identity, paths and responsibility', () => {
	const stated: contracts.ContractEntry = {
		...gamma,
		states: [{ id: 'g1', title: 'Gamma', coverage: 'required', scenario: 'examples-gamma' }]
	};
	const cases = [
		observe('a retired record with a state attached', stated, () =>
			selection.contractSummary(stated)
		)
	];
	const expected = {
		id: 'command.gamma',
		kind: 'command',
		title: 'Gamma command',
		path: 'src/gamma/command.ts',
		contractPath: 'specification/units/command.gamma.json',
		responsibility: 'Example responsibility for command.gamma.'
	};
	expect(outcomes(cases)).toEqual([expected]);
	expect(selection.contractSummary(stated)).not.toBe(stated);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'contractSummary',
			state: 'contractsummary-projects-identity-paths-and-responsibility',
			evidence: 'examples-cases',
			file: 'contractsummary-projects-identity-paths-and-responsibility.json'
		},
		cases
	);
});
