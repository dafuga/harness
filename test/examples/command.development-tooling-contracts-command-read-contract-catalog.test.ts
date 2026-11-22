import {
	zeta,
	flow
} from './command.development-tooling-contracts-command-read-contract-catalog.fixture';
import type {
	Refusal,
	Outcome
} from './command.development-tooling-contracts-command-read-contract-catalog.test.types';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import type { ContractEntry } from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { readContractCatalog } from '../../src/commands/development-tooling/contracts-command/readContractCatalog';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { contractUnit } from '../support/contractsProject';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * readContractCatalog is called on a project root as runContracts calls it. Each state writes a
 * registry into a temporary project, reads it, and asserts and records what came back: the unit
 * records, or the refusal. Temporary roots show as <root> and separators as /, so recorded messages
 * stay the same on every platform.
 */

const unitId = 'command.development-tooling-contracts-command-read-contract-catalog';
const symbol = 'readContractCatalog';
const evidence = 'examples-cases';

const alpha = contractUnit('command.alpha', 'src/commands/alpha.ts');
const beta = contractUnit('function.beta', 'src/core/beta.ts');

/** Writes the files into a fresh project, runs use on its root, and removes the project after. */
function inProject<T>(files: Record<string, unknown>, use: (root: string) => Promise<T>) {
	return withTempDir('contract-catalog-', async (root) => {
		for (const [path, body] of Object.entries(files)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
		}
		return use(root);
	});
}

/** The fields a caller reads from each record: its id, source path, contract file and states. */
export function summary(entries: ContractEntry[]) {
	return entries.map(({ id, path, contractPath, states }) => ({ id, path, contractPath, states }));
}

/** A refusal as a case records it, with the temporary root shown as <root>. */
function refusal(error: unknown, root: string): Refusal {
	const failure = error as Error & { code?: string };
	return {
		expected: error instanceof ExpectedCliError,
		name: failure.name,
		code: failure.code ?? null,
		message: failure.message.split(root).join('<root>').replaceAll('\\', '/')
	};
}

/** What reading the project gave: its records as output, or the refusal it gave as error. */
function outcomeOf(files: Record<string, unknown>, includeStates?: boolean): Promise<Outcome> {
	return inProject(files, async (root): Promise<Outcome> => {
		try {
			return { output: summary(await readContractCatalog(root, includeStates)) };
		} catch (error) {
			return { error: refusal(error, root) };
		}
	});
}

/** The refusal of an ExpectedCliError: its name and message, with no error code. */
function cliRefusal(message: string): Refusal {
	return { expected: true, name: 'ExpectedCliError', code: null, message };
}

/** The input a case records: the files written into the project. */
const filesOf = (files: Record<string, unknown>) => ({ files: Object.keys(files) });

test('Lists nested units', async () => {
	const files = {
		'specification/units/shared/function.zeta.json': zeta,
		'specification/units/tools/command.alpha.json': alpha,
		'specification/units/README.md': '# Units',
		'src/fixtures/sample.json': { notAManifest: true }
	};
	const listed = await outcomeOf(files);
	const listOnly = await outcomeOf(files, false);
	expect(listed.output?.map(({ id, path, contractPath }) => [id, path, contractPath])).toEqual([
		['command.alpha', 'src/commands/alpha.ts', 'specification/units/tools/command.alpha.json'],
		['function.zeta', 'src/core/zeta.ts', 'specification/units/shared/function.zeta.json']
	]);
	expect(listOnly).toEqual(listed);
	const all = filesOf(files);
	const off = { ...all, includeStates: false };
	recordExampleCases(
		{ unitId, symbol, state: 'lists-nested-units', evidence, file: 'lists-nested-units.json' },
		[
			{ name: 'nested units with the default includeStates', input: all, ...listed },
			{ name: 'the same units with includeStates false', input: off, ...listOnly }
		]
	);
});

test('Attaches states', async () => {
	const files = {
		'specification/units/tools/command.alpha.json': { ...alpha, scenarios: ['flow'] },
		'specification/units/shared/function.beta.json': beta,
		'specification/scenarios/flow.json': flow
	};
	const broken = { ...files, 'specification/scenarios/broken.json': { schemaVersion: 1 } };
	const attached = await outcomeOf(files);
	const unattached = await outcomeOf(files, false);
	const refused = await outcomeOf(broken, true);
	const skipped = await outcomeOf(broken, false);
	const shared = { scenario: 'flow', id: 'shared', title: 'Both units', coverage: 'required' };
	const betaOnly = { ...shared, id: 'beta-only', title: 'Beta only', units: ['function.beta'] };
	expect(attached.output?.map((entry) => entry.states)).toEqual([[shared], [shared, betaOnly]]);
	expect(unattached.output?.map((entry) => entry.states)).toEqual([[], []]);
	expect(refused.error).toEqual(
		cliRefusal(
			'Invalid scenario contract specification/scenarios/broken.json: Invalid input: expected string, received undefined'
		)
	);
	expect(skipped).toEqual(unattached);
	const all = filesOf(files);
	const off = { ...all, includeStates: false };
	const bad = { ...filesOf(broken), includeStates: true };
	const badOff = { ...filesOf(broken), includeStates: false };
	recordExampleCases(
		{ unitId, symbol, state: 'attaches-states', evidence, file: 'attaches-states.json' },
		[
			{ name: 'default includeStates attaches named states', input: all, ...attached },
			{ name: 'includeStates false lists units without states', input: off, ...unattached },
			{ name: 'includeStates true refuses an invalid scenario', input: bad, ...refused },
			{ name: 'includeStates false skips the invalid scenario', input: badOff, ...skipped }
		]
	);
});

test('Refuses duplicate id', async () => {
	const again = contractUnit('command.alpha', 'src/commands/alpha-again.ts');
	const duplicates = {
		'specification/units/first.json': alpha,
		'specification/units/second/again.json': again
	};
	const sameName = {
		'specification/units/a/index.json': alpha,
		'specification/units/b/index.json': beta
	};
	const refused = await outcomeOf(duplicates);
	const listed = await outcomeOf(sameName);
	expect(refused.error).toEqual(
		cliRefusal('Duplicate contract id "command.alpha" (specification/units/second/again.json).')
	);
	expect(listed.output?.map((entry) => entry.id)).toEqual(['command.alpha', 'function.beta']);
	recordExampleCases(
		{ unitId, symbol, state: 'refuses-duplicate-id', evidence, file: 'refuses-duplicate-id.json' },
		[
			{ name: 'two files declare command.alpha', input: filesOf(duplicates), ...refused },
			{ name: 'same file name in two folders, distinct ids', input: filesOf(sameName), ...listed }
		]
	);
});

test('Refuses invalid unit', async () => {
	const notJson = { 'specification/units/broken.json': '{ "id": ' };
	const badId = { 'specification/units/upper.json': { ...alpha, id: 'Command.Alpha' } };
	const badStatus = { 'specification/units/paused.json': { ...beta, status: 'paused' } };
	const unreadable = await outcomeOf(notJson);
	const wrongId = await outcomeOf(badId);
	const wrongStatus = await outcomeOf(badStatus);
	expect(unreadable.error).toEqual(
		cliRefusal('Cannot read JSON contract specification/units/broken.json.')
	);
	expect(wrongId.error).toEqual(
		cliRefusal(
			'Invalid contract specification/units/upper.json: id: must be a lowercase dotted or dashed identifier'
		)
	);
	expect(wrongStatus.error).toEqual(
		cliRefusal(
			'Invalid contract specification/units/paused.json: status: Invalid option: expected one of "active"|"retired"'
		)
	);
	recordExampleCases(
		{ unitId, symbol, state: 'refuses-invalid-unit', evidence, file: 'refuses-invalid-unit.json' },
		[
			{ name: 'a unit file that is not JSON', input: filesOf(notJson), ...unreadable },
			{ name: 'a unit whose id is not a dotted identifier', input: filesOf(badId), ...wrongId },
			{ name: 'a unit with an unknown status', input: filesOf(badStatus), ...wrongStatus }
		]
	);
});

test('Missing folder empty', async () => {
	const absent = await outcomeOf({});
	const notFolder = { 'specification/units': 'A file where the units folder belongs.' };
	const refused = await outcomeOf(notFolder);
	expect(absent.output).toEqual([]);
	expect(refused.error).toEqual({
		expected: false,
		name: 'Error',
		code: 'ENOTDIR',
		message: "ENOTDIR: not a directory, scandir '<root>/specification/units'"
	});
	recordExampleCases(
		{ unitId, symbol, state: 'missing-folder-empty', evidence, file: 'missing-folder-empty.json' },
		[
			{ name: 'no specification/units folder in the project', input: { files: [] }, ...absent },
			{ name: 'specification/units is a file, not a folder', input: filesOf(notFolder), ...refused }
		]
	);
});
