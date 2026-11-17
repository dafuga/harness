import { Command, CommanderError } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { registerUnitsCommand } from '../../src/cli/program/UnitsCommand';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * registerUnitsCommand is called on a program the way buildProgram calls it. A state either
 * dispatches argv through commander, so an action runs only when commander reaches it, or runs an
 * action that reads the registry from the working directory. Those states change into a fresh Git
 * repository and change back before they assert or record, so nothing outside it is written.
 */

type Schema = { type: string; required: string[]; properties: Record<string, unknown> };
type Subcommand = [name: string, args: string[], options: string[]];
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const unitsDescription =
	'Maintain the unit registry: stable identities, contracts and the source graph.';

/** The subcommands in the order registerUnitsCommand attaches them, with their arguments and flags. */
const expectedSubcommands: Subcommand[] = [
	['index', [], ['--write', '--json']],
	['check', [], ['--json']],
	['list', [], ['--kind <kind>', '--json']],
	['show', ['<id>'], ['--json']],
	['graph', [], ['--json']],
	['retire', ['<id>'], ['--reason <text>']],
	['schema', ['<name>'], []],
	['guide', ['<id>'], ['--json', '--required-states <paths...>']],
	['check-contract', ['[id]'], ['--all', '--json', '--required-states <paths...>']],
	['uid-backfill', [], ['--write', '--json']],
	['rename', ['<id>', '<newId>'], []]
];

afterEach(() => {
	vi.restoreAllMocks();
});

/** A program named as buildProgram names it; commander's own output is silenced and exits are thrown. */
function harnessProgram(): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
}

/** Parses argv against a program that holds the units command, as the CLI does. */
async function parse(argv: string[]): Promise<void> {
	const program = harnessProgram();
	registerUnitsCommand(program);
	await program.parseAsync(argv, { from: 'user' });
}

/** The error that stopped argv, or undefined when the dispatch completed. */
async function failure(argv: string[]): Promise<unknown> {
	try {
		await parse(argv);
	} catch (error) {
		return error;
	}
	return undefined;
}

/** A thrown error as a plain record of its class name and message. */
function failed(error: unknown): { name: string; message: string } {
	const { name, message } = error as Error;
	return { name, message };
}

/** Runs use in a new Git repository holding the given files, with the working directory set to it. */
async function inRepository(
	files: Record<string, string>,
	use: () => Promise<unknown>
): Promise<unknown> {
	return withTempRepo(async ({ root }) => {
		for (const [path, text] of Object.entries(files)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), text);
		}
		const original = process.cwd();
		process.chdir(root);
		try {
			return await use();
		} finally {
			process.chdir(original);
		}
	});
}

/** The units command that registerUnitsCommand attached to the program. */
function unitsOf(program: Command): Command {
	const units = program.commands.find((command) => command.name() === 'units');
	if (!units) throw new Error('registerUnitsCommand attached no units command');
	return units;
}

/** Each subcommand as its callers see it: its name, its argument labels and its option flags. */
function subcommands(units: Command): Subcommand[] {
	return units.commands.map((command): Subcommand => [
		command.name(),
		command.registeredArguments.map((argument) =>
			argument.required ? `<${argument.name()}>` : `[${argument.name()}]`
		),
		command.options.map((option) => option.flags)
	]);
}

/** One refused dispatch as a recorded case: the argv given and the commander error it raised. */
function refused(name: string, argv: string[], stop: CommanderError): ExampleCase {
	return {
		name,
		input: { argv },
		error: { code: stop.code, exitCode: stop.exitCode, message: stop.message }
	};
}

/** Records the cases of one state; the state id is the test title in the form the scenario derives. */
function record(state: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{
			unitId: 'command.units',
			symbol: 'registerUnitsCommand',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('registerUnitsCommand attached the units command tree', () => {
	const program = new Command().name('harness');
	expect(registerUnitsCommand(program)).toBeUndefined();
	const units = unitsOf(program);
	expect(program.commands.map((command) => command.name())).toEqual(['units']);
	expect(units.description()).toBe(unitsDescription);
	expect(subcommands(units)).toEqual(expectedSubcommands);
	const beside = new Command().name('harness');
	beside.command('status');
	registerUnitsCommand(beside);
	expect(beside.commands.map((command) => command.name())).toEqual(['status', 'units']);
	record('registerunitscommand-attached-the-units-command-tree', [
		{
			name: 'a harness program with no other commands',
			input: { program: 'harness', existing: [] },
			output: { returned: null, programCommands: ['units'], subcommands: subcommands(units) }
		},
		{
			name: 'a harness program that already has a status command',
			input: { program: 'harness', existing: ['status'] },
			output: { returned: null, programCommands: ['status', 'units'] }
		}
	]);
});

test('units schema printed the JSON Schema of ComponentManifest', async () => {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	await parse(['units', 'schema', 'ComponentManifest']);
	const printed = log.mock.calls.map((args) => String(args[0]));
	expect(printed).toHaveLength(1);
	const schema = JSON.parse(printed[0]) as Schema;
	const names = Object.keys(schema.properties);
	expect(schema.type).toBe('object');
	expect(schema.required).toContain('id');
	expect(names).toContain('uid');
	record('units-schema-printed-the-json-schema-of-componentmanifest', [
		{
			name: 'the ComponentManifest schema',
			input: { argv: ['units', 'schema', 'ComponentManifest'] },
			output: { type: schema.type, required: schema.required, properties: names }
		}
	]);
});

test('units commands stopped in commander before any action ran', async () => {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	const attempts: Array<[string, string[]]> = [
		['retire without --reason', ['units', 'retire', 'unit.example']],
		['show without an id', ['units', 'show']],
		['rename without a new id', ['units', 'rename', 'unit.example']],
		['list with an unknown option', ['units', 'list', '--bogus']]
	];
	const stops = await Promise.all(attempts.map(([, argv]) => failure(argv)));
	expect(stops.every((stop) => stop instanceof CommanderError)).toBe(true);
	const commander = stops as CommanderError[];
	expect(commander.map((stop) => stop.code)).toEqual([
		'commander.missingMandatoryOptionValue',
		'commander.missingArgument',
		'commander.missingArgument',
		'commander.unknownOption'
	]);
	expect(commander.map((stop) => stop.message)).toEqual([
		"error: required option '--reason <text>' not specified",
		"error: missing required argument 'id'",
		"error: missing required argument 'newId'",
		"error: unknown option '--bogus'"
	]);
	expect(log.mock.calls).toEqual([]);
	record(
		'units-commands-stopped-in-commander-before-any-action-ran',
		attempts.map(([name, argv], index) => refused(name, argv, commander[index]))
	);
});

test('units check refused two broken unit files as one error', async () => {
	const files = {
		'specification/units/alpha.json': '{ "id": ',
		'specification/units/beta.json': '[]'
	};
	const error = await inRepository(files, () => failure(['units', 'check']));
	expect(error).toBeInstanceOf(ExpectedCliError);
	const lines = failed(error).message.split('\n');
	expect(lines.map((line) => line.split(':')[0])).toEqual(['alpha', 'beta']);
	record('units-check-refused-two-broken-unit-files-as-one-error', [
		{
			name: 'alpha.json is not valid JSON and beta.json is an array',
			input: { argv: ['units', 'check'], files: Object.keys(files) },
			error: failed(error)
		}
	]);
});

test('units check printed a valid summary for an empty registry', async () => {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	await inRepository({}, () => parse(['units', 'check']));
	const printed = log.mock.calls.map((args) => String(args[0]));
	expect(printed).toEqual(['Units registry is valid: 0 units, 0 uncertain references.']);
	record('units-check-printed-a-valid-summary-for-an-empty-registry', [
		{
			name: 'a repository with no unit files',
			input: { argv: ['units', 'check'], files: [] },
			output: { printed }
		}
	]);
});
