import type { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { commandLoaders } from '../../src/cli/commandLoaders';
import { loadCliProgram } from '../../src/cli/loadCliProgram';

type ProgramSummary = { name: string; version: string | null; commands: string[] };
type ErrorSummary = { name: string; message: string };
type Loader = (program: Command) => Promise<void>;

async function summarise(args: readonly string[]): Promise<ProgramSummary> {
	const program = await loadCliProgram(args);
	return {
		name: program.name(),
		version: program.version() ?? null,
		commands: program.commands.map((command) => command.name())
	};
}

async function withUnitsLoader<T>(loader: Loader, run: () => Promise<T>): Promise<T> {
	const original = commandLoaders.units;
	commandLoaders.units = loader;
	try {
		return await run();
	} finally {
		commandLoaders.units = original;
	}
}

async function rejectionOf(promise: Promise<unknown>): Promise<ErrorSummary> {
	let error: unknown;
	try {
		await promise;
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

test('Registers the selected family with root help placeholders', async () => {
	const units = await summarise(['units']);
	const impact = await summarise(['help', 'impact']);
	const none = await summarise([]);

	expect(units.name).toBe('harness');
	expect(units.version).toMatch(/\S/);
	expect(units.commands).toContain('units');
	expect(impact.commands).toContain('impact');
	expect(none.commands.length).toBeGreaterThan(0);
	expect(units.commands).toContain('impact');
	expect(none.commands).toContain('units');

	recordExampleCases(
		{
			unitId: 'entry.load-cli-program',
			symbol: 'loadCliProgram',
			state: 'registers-the-selected-family-with-root-help-placeholders',
			evidence: 'examples-cases',
			file: 'registers-the-selected-family-with-root-help-placeholders.json'
		},
		[
			{ name: 'units token loads the units family', input: ['units'], output: units },
			{ name: 'help impact loads the impact family', input: ['help', 'impact'], output: impact },
			{ name: 'no token leaves every row as a placeholder', input: [], output: none }
		]
	);
});

test('Throws Selected command registration failure when the loader rejects', async () => {
	const error = await withUnitsLoader(
		() => Promise.reject(new Error('units import failed')),
		() => rejectionOf(loadCliProgram(['units']))
	);

	expect(error).toEqual({ name: 'Error', message: 'units import failed' });

	recordExampleCases(
		{
			unitId: 'entry.load-cli-program',
			symbol: 'loadCliProgram',
			state: 'throws-selected-command-registration-failure-when-the-loader',
			evidence: 'examples-cases',
			file: 'throws-selected-command-registration-failure-when-the-loader.json'
		},
		[{ name: 'units loader rejects', input: ['units'], error }]
	);
});

test('Throws Selected command registration failure when registration throws', async () => {
	const error = await withUnitsLoader(
		(program) => {
			program.command('partial');
			throw new Error('registration stopped');
		},
		() => rejectionOf(loadCliProgram(['units']))
	);

	expect(error).toEqual({ name: 'Error', message: 'registration stopped' });

	recordExampleCases(
		{
			unitId: 'entry.load-cli-program',
			symbol: 'loadCliProgram',
			state: 'throws-selected-command-registration-failure-when-registrati',
			evidence: 'examples-cases',
			file: 'throws-selected-command-registration-failure-when-registrati.json'
		},
		[{ name: 'units registration throws after adding a command', input: ['units'], error }]
	);
});
