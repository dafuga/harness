import { mkdir, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { attachContractStates } from '../../src/commands/development-tooling/contracts-command/contractStates';
import type { ContractEntry } from '../../src/commands/development-tooling/contracts-command/contracts.types';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * attachContractStates is called the way readContractCatalog calls it: stored entries and a project
 * root. Each test writes declarations into a temporary root, calls the unit, and records the states
 * every entry received or the error the declarations raised.
 */

const unitId = 'command.development-tooling-contracts-command-contract-states';
const symbol = 'attachContractStates';
const evidence = 'examples-cases';
const scenarios = 'specification/scenarios';
type State = ScenarioManifest['states'][number];

/** A stored entry as readContractCatalog builds it: the parsed manifest and no states yet. */
function storedEntry(id: string, scenarioIds: string[] = []): ContractEntry {
	const source = `src/${id}.ts`;
	const manifest: ContractEntry['manifest'] = {
		schemaVersion: 1,
		id,
		kind: 'command',
		title: id,
		responsibility: `Example unit ${id}.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [], errorStatus: 'declared' },
		dependencies: [],
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: scenarioIds,
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	return {
		id,
		kind: 'command',
		title: id,
		path: source,
		contractPath: `specification/units/${id}.json`,
		responsibility: manifest.responsibility,
		manifest,
		states: []
	};
}

/** A declared scenario with one unit check and no evidence; units lists the entries it covers. */
function declaredScenario(id: string, units: string[], states: State[]): ScenarioManifest {
	return {
		schemaVersion: 1,
		id,
		title: `Scenario ${id}`,
		kind: 'headless',
		units,
		states,
		viewports: [],
		tests: [{ id: 'unit', kind: 'unit', runner: 'vitest', target: 'test/example.test.ts' }],
		evidence: []
	};
}

/** A required state titled by its id; a units list narrows it to the entries it names. */
function declaredState(id: string, units?: string[]): State {
	return { id, title: id, coverage: 'required', ...(units && { units }) };
}

/** Stores a file under the project root, creating its folders first. */
async function storeFile(root: string, path: string, text: string): Promise<void> {
	await mkdir(join(root, dirname(path)), { recursive: true });
	await writeFile(join(root, path), text);
}

/** The rejection message of a promise, or an empty string when it resolves. */
async function messageOf(pending: Promise<unknown>): Promise<string> {
	return pending.then(
		() => '',
		(error: Error) => error.message
	);
}

/** Attaches to one entry whose only declaration is text, and returns the message it rejects with. */
async function rejectionFor(text: string): Promise<string> {
	return withTempDir('contract-states-', async (root) => {
		await storeFile(root, `${scenarios}/bad.json`, text);
		const pending = attachContractStates([storedEntry('command.alpha')], root);
		await expect(pending).rejects.toBeInstanceOf(ExpectedCliError);
		return messageOf(pending);
	});
}

/** The declarations that decide which states reach each entry, as plain values. */
const ownership = (entries: ContractEntry[]) =>
	entries.map(({ id, manifest }) => ({ id, scenarios: manifest.scenarios }));
/** The states each entry holds after the call, as plain values. */
const statesOf = (entries: ContractEntry[]) => entries.map(({ id, states }) => ({ id, states }));
/** The state ids each entry holds, in order. */
const stateIds = (entries: ContractEntry[]) =>
	entries.map(({ states }) => states.map((state) => state.id));

test('Appends matching declared states and keeps existing ones', async () => {
	await withTempDir('contract-states-', async (root) => {
		const states = [declaredState('ready'), declaredState('failing', ['command.alpha'])];
		const declared = declaredScenario('scenario.alpha', ['command.beta'], states);
		await storeFile(root, `${scenarios}/alpha.json`, JSON.stringify(declared));
		const alpha = storedEntry('command.alpha', ['scenario.alpha']);
		const legacy = { ...declaredState('legacy'), scenario: 'scenario.older' };
		alpha.states.push(legacy);
		const entries = [alpha, storedEntry('command.beta'), storedEntry('command.gamma')];
		const input = { entries: ownership(entries), declarations: [declared] };
		await attachContractStates(entries, root);
		const ready = { ...declaredState('ready'), scenario: 'scenario.alpha' };
		const failing = { ...declaredState('failing', ['command.alpha']), scenario: 'scenario.alpha' };
		expect(statesOf(entries)).toEqual([
			{ id: 'command.alpha', states: [legacy, ready, failing] },
			{ id: 'command.beta', states: [ready] },
			{ id: 'command.gamma', states: [] }
		]);
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'appends-matching-declared-states-and-keeps-existing-ones',
				evidence,
				file: 'appends-matching-declared-states-and-keeps-existing-ones.json'
			},
			[
				{
					name: 'beta by units, alpha by its scenarios, failing only for alpha',
					input,
					output: statesOf(entries)
				}
			]
		);
	});
});

test('Reads nested JSON declarations and ignores other files', async () => {
	await withTempDir('contract-states-', async (root) => {
		const top = declaredScenario('top', ['command.alpha'], [declaredState('top-ready')]);
		const deep = declaredScenario('deep', ['command.beta'], [declaredState('deep-ready')]);
		const linked = declaredScenario('linked', ['command.gamma'], [declaredState('linked-ready')]);
		await storeFile(root, `${scenarios}/top.json`, JSON.stringify(top));
		await storeFile(root, `${scenarios}/nested/deeper/deep.json`, JSON.stringify(deep));
		await storeFile(root, `${scenarios}/notes.md`, 'Not JSON, so it must never be parsed.');
		await storeFile(root, 'outside/linked.json', JSON.stringify(linked));
		await symlink(join(root, 'outside/linked.json'), join(root, `${scenarios}/linked.json`));
		const entries = ['command.alpha', 'command.beta', 'command.gamma'].map((id) => storedEntry(id));
		const files = ['top.json', 'nested/deeper/deep.json', 'notes.md', 'linked.json (symlink)'];
		const input = { entries: ownership(entries), files };
		await attachContractStates(entries, root);
		expect(stateIds(entries)).toEqual([['top-ready'], ['deep-ready'], []]);
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'reads-nested-json-declarations-and-ignores-other-files',
				evidence,
				file: 'reads-nested-json-declarations-and-ignores-other-files.json'
			},
			[{ name: 'nested read; markdown and symlink skipped', input, output: statesOf(entries) }]
		);
	});
});

test('Treats a missing scenarios folder as empty', async () => {
	await withTempDir('contract-states-', async (root) => {
		const entries = [storedEntry('command.alpha')];
		const input = { entries: ownership(entries), folder: 'missing' };
		const returned = await attachContractStates(entries, root);
		expect(returned).toBeUndefined();
		const output = { returned: String(returned), entries: statesOf(entries) };
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'treats-a-missing-scenarios-folder-as-empty',
				evidence,
				file: 'treats-a-missing-scenarios-folder-as-empty.json'
			},
			[{ name: 'root with no specification/scenarios folder', input, output }]
		);
	});
});

test('Rethrows a non-missing listing error unchanged', async () => {
	await withTempDir('contract-states-', async (root) => {
		await storeFile(root, scenarios, 'A file where the scenarios folder should be.');
		const entries = [storedEntry('command.alpha')];
		const input = { entries: ownership(entries), folder: 'a file' };
		const pending = attachContractStates(entries, root);
		await expect(pending).rejects.toMatchObject({ code: 'ENOTDIR' });
		const message = await messageOf(pending);
		expect(message).toBe(await messageOf(readdir(join(root, scenarios))));
		const error = { code: 'ENOTDIR', message: message.split(root).join('<root>') };
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'rethrows-a-non-missing-listing-error-unchanged',
				evidence,
				file: 'rethrows-a-non-missing-listing-error-unchanged.json'
			},
			[{ name: 'specification/scenarios is a file, not a folder', input, error }]
		);
	});
});

test('Rejects an unreadable or invalid scenario document', async () => {
	const truncated = '{ "schemaVersion": 1,';
	const noStates = declaredScenario('bad', ['command.alpha'], []);
	const unreadable = await rejectionFor(truncated);
	const invalid = await rejectionFor(JSON.stringify(noStates));
	const label = join(scenarios, 'bad.json');
	expect(unreadable).toBe(`Cannot read JSON contract ${label}.`);
	expect(invalid).toBe(
		`Invalid scenario contract ${label}: Too small: expected array to have >=1 items`
	);
	const failure = (message: string) => ({ name: 'ExpectedCliError', message });
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'rejects-an-unreadable-or-invalid-scenario-document',
			evidence,
			file: 'rejects-an-unreadable-or-invalid-scenario-document.json'
		},
		[
			{ name: 'truncated JSON', input: { text: truncated }, error: failure(unreadable) },
			{ name: 'empty states list', input: { document: noStates }, error: failure(invalid) }
		]
	);
});
