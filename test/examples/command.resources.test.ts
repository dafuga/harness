import { Command, CommanderError, type Option } from 'commander';
import { test } from 'vitest';
import { registerResourcesCommand } from '../../src/cli/program/ResourcesCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * registerResourcesCommand is called on a program the way buildProgram calls it. The status,
 * configure and run actions read the resource home from the environment and sample this machine,
 * so they are not dispatched here. The examples show what was attached, and that commander refuses
 * help and bad input before any action runs. Registration stores nothing: no temporary directory.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
type Written = { stdout: string[]; stderr: string[] };
type Stopped = { written: Written; stop: CommanderError };
type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default?: unknown }>;
	commands: Described[];
};

/** A program named as buildProgram names it. Output is captured and exits are thrown, not made. */
function harnessProgram(written: Written): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => {
				written.stdout.push(text);
			},
			writeErr: (text) => {
				written.stderr.push(text);
			},
			getOutHelpWidth: () => 80,
			getErrHelpWidth: () => 80
		});
}

/** Registers the resources command on a program that already holds the named commands. */
function registered(existing: string[]): { root: Command; returned: unknown; written: Written } {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	for (const name of existing) root.command(name);
	const returned: unknown = registerResourcesCommand(root);
	return { root, returned, written };
}

/** Parses argv against a fresh program and returns the commander stop that ended the parse. */
async function dispatch(argv: string[]): Promise<Stopped> {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	registerResourcesCommand(root);
	try {
		await root.parseAsync(argv, { from: 'user' });
	} catch (error) {
		if (error instanceof CommanderError) return { written, stop: error };
		throw error;
	}
	throw new Error(`${argv.join(' ')} ran without commander stopping it`);
}

function optionOf(option: Option): Described['options'][number] {
	return option.defaultValue === undefined
		? { flags: option.flags }
		: { flags: option.flags, default: option.defaultValue };
}

/** A command as its callers read it: name, description, arguments, options and subcommands. */
function described(command: Command): Described {
	return {
		name: command.name(),
		description: command.description(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map(optionOf),
		commands: command.commands.map(described)
	};
}

function subcommand(tree: Described, name: string): Described {
	const found = tree.commands.find((command) => command.name === name);
	if (!found) throw new Error(`${tree.name} has no ${name} subcommand`);
	return found;
}

/** One dispatch as a recorded case: the help commander printed, or the reason it refused. */
function outcome(name: string, input: string[], { written, stop }: Stopped): ExampleCase {
	if (stop.code === 'commander.helpDisplayed')
		return {
			name,
			input,
			output: { exitCode: stop.exitCode, help: written.stdout.join('').trimEnd().split('\n') }
		};
	return {
		name,
		input,
		error: { code: stop.code, exitCode: stop.exitCode, message: stop.message }
	};
}

/** The resources group as registered on the program, with its subcommands and their options. */
function attachedTree(root: Command): Described {
	const resources = root.commands.find((command) => command.name() === 'resources');
	if (!resources) throw new Error('no resources command was attached');
	return described(resources);
}

/** The subcommands and the options and arguments a user can pass to each of them. */
function expectShape(tree: Described): void {
	expect(tree.description).toBe('Shared CPU and memory admission for managed work.');
	expect(tree.commands.map((command) => command.name)).toEqual(['status', 'configure', 'run']);
	expect(subcommand(tree, 'status').options).toEqual([{ flags: '--json' }]);
	expect(subcommand(tree, 'configure').options).toEqual([
		{ flags: '--cpu-reserve-percent <n>' },
		{ flags: '--memory-reserve-percent <n>' },
		{ flags: '--min-memory-reserve-mib <n>' }
	]);
	expect(subcommand(tree, 'run').description).toBe(
		'Queue a command; preserve CPU and memory reserves.'
	);
	expect(subcommand(tree, 'run').arguments).toEqual([{ name: 'command', required: true }]);
	expect(subcommand(tree, 'run').options).toContainEqual({
		flags: '--label <label>',
		default: 'Managed work'
	});
	expect(subcommand(tree, 'run').options).toContainEqual({
		flags: '--wait-timeout <ms>',
		default: '1800000'
	});
}

test('registerResourcesCommand attached the resources group', () => {
	const alone = registered([]);
	const beside = registered(['activity']);
	const tree = attachedTree(alone.root);
	expectShape(tree);
	expect(alone.returned).toBeUndefined();
	expect(beside.root.commands.map((command) => command.name())).toEqual(['activity', 'resources']);
	expect(alone.written.stdout).toEqual([]);
	expect(alone.written.stderr).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.resources',
			symbol: 'registerResourcesCommand',
			state: 'registerresourcescommand-attached-the-resources-group',
			evidence: 'examples-cases',
			file: 'registerresourcescommand-attached-the-resources-group.json'
		},
		[
			{
				name: 'a program named harness with no other commands',
				input: { program: 'harness', existing: [] },
				output: {
					returned: typeof alone.returned,
					resources: tree,
					programCommands: alone.root.commands.map((command) => command.name())
				}
			},
			{
				name: 'a program named harness that already has an activity command',
				input: { program: 'harness', existing: ['activity'] },
				output: {
					returned: typeof beside.returned,
					programCommands: beside.root.commands.map((command) => command.name())
				}
			}
		]
	);
});

test('registerResourcesCommand left refused input to commander', async () => {
	const statusHelp = await dispatch(['resources', 'status', '--help']);
	const bare = await dispatch(['resources']);
	const unknown = await dispatch(['resources', 'bogus']);
	const runBare = await dispatch(['resources', 'run']);
	const valueless = await dispatch(['resources', 'configure', '--cpu-reserve-percent']);
	const bogus = await dispatch(['resources', 'configure', '--bogus']);
	expect(statusHelp.stop.code).toBe('commander.helpDisplayed');
	expect(statusHelp.written.stdout.join('')).toContain('Usage: harness resources status [options]');
	expect(bare.stop.code).toBe('commander.help');
	expect(bare.stop.exitCode).toBe(1);
	expect(bare.written.stderr.join('')).toContain('Usage: harness resources [options] [command]');
	expect(unknown.stop.message).toBe("error: unknown command 'bogus'");
	expect(runBare.stop.message).toBe("error: missing required argument 'command'");
	expect(valueless.stop.message).toBe("error: option '--cpu-reserve-percent <n>' argument missing");
	expect(bogus.stop.message).toBe("error: unknown option '--bogus'");
	const printed = [bare, unknown, runBare, valueless, bogus].flatMap(
		({ written }) => written.stdout
	);
	expect(printed).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.resources',
			symbol: 'registerResourcesCommand',
			state: 'registerresourcescommand-left-refused-input-to-commander',
			evidence: 'examples-cases',
			file: 'registerresourcescommand-left-refused-input-to-commander.json'
		},
		[
			outcome('status --help', ['resources', 'status', '--help'], statusHelp),
			outcome('resources with no subcommand', ['resources'], bare),
			outcome('an unknown subcommand', ['resources', 'bogus'], unknown),
			outcome('run without a command', ['resources', 'run'], runBare),
			outcome(
				'configure reserve flag without a value',
				['resources', 'configure', '--cpu-reserve-percent'],
				valueless
			),
			outcome('configure with an unknown option', ['resources', 'configure', '--bogus'], bogus)
		]
	);
});
