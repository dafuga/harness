import { Command, CommanderError, type Option } from 'commander';
import { test } from 'vitest';
import { registerConsoleCommand } from '../../src/cli/program/ConsoleCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * registerConsoleCommand is called the way buildProgram calls it. The examples show what it
 * attached and where commander stops before a subcommand action: help and refused input never
 * reach one. The actions read or write a SvelteKit host, so none runs here; registration stores
 * nothing.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
type Written = { stdout: string[]; stderr: string[] };
type Stopped = { written: Written; stop: CommanderError };
type Registered = { root: Command; consoleCommand: Command; written: Written };
type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; mandatory: boolean; default?: unknown }>;
	commands: Described[];
};

/**
 * A program named as buildProgram names it. Output is captured and exits are thrown rather than
 * made; commander copies both into each subcommand created after they are set. The help width is
 * fixed so the recorded help does not depend on the terminal.
 */
function harnessProgram(written: Written): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => written.stdout.push(text),
			writeErr: (text) => written.stderr.push(text),
			getOutHelpWidth: () => 120,
			getErrHelpWidth: () => 120
		});
}

/** Registers the console command on a program that already holds the named commands. */
function registered(existing: string[]): Registered {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	for (const name of existing) root.command(name);
	return { root, consoleCommand: registerConsoleCommand(root), written };
}

/** Parses argv against a fresh program and returns the commander stop that ended the parse. */
async function dispatch(argv: string[]): Promise<Stopped> {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	registerConsoleCommand(root);
	try {
		await root.parseAsync(argv, { from: 'user' });
	} catch (error) {
		if (error instanceof CommanderError) return { written, stop: error };
		throw error;
	}
	throw new Error(`${argv.join(' ')} ran without commander stopping it`);
}

function optionOf(option: Option): Described['options'][number] {
	const base = { flags: option.flags, mandatory: option.mandatory };
	return option.defaultValue === undefined ? base : { ...base, default: option.defaultValue };
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

/** The flags a command requires, as its callers see them. */
function mandatoryFlags(command: Described): string[] {
	return command.options.filter((option) => option.mandatory).map((option) => option.flags);
}

/** The flags that carry a default, with the default each one gets. */
function defaults(command: Described): Record<string, unknown> {
	const withDefault = command.options.filter((option) => 'default' in option);
	return Object.fromEntries(withDefault.map((option) => [option.flags, option.default]));
}

/** The names of the subcommands a command holds, in the order they were added. */
function names(command: Command): string[] {
	return command.commands.map((item) => item.name());
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

test('registerConsoleCommand added a console command with four subcommands, then returned it', () => {
	const alone = registered([]);
	const beside = registered(['status']);
	const tree = described(alone.consoleCommand);
	const install = subcommand(tree, 'install');
	expect(alone.consoleCommand.name()).toBe('console');
	expect(alone.consoleCommand.description()).toBe(
		'Embed the Harness console in a SvelteKit application, behind its own admin policy.'
	);
	expect(alone.consoleCommand === alone.root).toBe(false);
	expect(alone.root.commands.includes(alone.consoleCommand)).toBe(true);
	expect(names(alone.consoleCommand)).toEqual(['install', 'objects', 'uninstall', 'restore']);
	expect(mandatoryFlags(install)).toEqual(['--host <directory>', '--policy <module>']);
	expect(defaults(install)).toEqual({
		'--policy-export <name>': 'harnessPolicy',
		'--base <path>': '/harness'
	});
	expect(mandatoryFlags(subcommand(tree, 'objects'))).toEqual(['--data <directory>']);
	expect(mandatoryFlags(subcommand(tree, 'uninstall'))).toEqual(['--host <directory>']);
	expect(mandatoryFlags(subcommand(tree, 'restore'))).toEqual(['--host <directory>']);
	expect(subcommand(tree, 'restore').arguments).toEqual([{ name: 'path', required: true }]);
	expect(names(beside.root)).toEqual(['status', 'console']);
	expect(alone.written.stdout).toEqual([]);
	expect(alone.written.stderr).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.console',
			symbol: 'registerConsoleCommand',
			state: 'registerconsolecommand-added-a-console-command-with-four-sub',
			evidence: 'examples-cases',
			file: 'registerconsolecommand-added-a-console-command-with-four-sub.json'
		},
		[
			{
				name: 'a program named harness with no other commands',
				input: { program: 'harness', existing: [] },
				output: { returned: tree, programCommands: names(alone.root) }
			},
			{
				name: 'a program named harness that already has a status command',
				input: { program: 'harness', existing: ['status'] },
				output: { returned: described(beside.consoleCommand), programCommands: names(beside.root) }
			}
		]
	);
});

test('registerConsoleCommand left subcommand help and refused input to commander, so no action ran', async () => {
	const consoleHelp = await dispatch(['console', '--help']);
	const installHelp = await dispatch(['console', 'install', '--help']);
	const noPolicy = await dispatch(['console', 'install', '--host', 'site']);
	const noData = await dispatch(['console', 'objects']);
	const noPath = await dispatch(['console', 'restore', '--host', 'site']);
	const bogus = await dispatch(['console', 'uninstall', '--host', 'site', '--bogus']);
	const refused = [noPolicy, noData, noPath, bogus];
	expect(consoleHelp.stop.code).toBe('commander.helpDisplayed');
	expect(installHelp.stop.code).toBe('commander.helpDisplayed');
	expect(consoleHelp.written.stdout.join('')).toContain('restore [options] <path>');
	expect(installHelp.written.stdout.join('')).toContain('(default: "harnessPolicy")');
	expect(refused.map(({ stop }) => stop.code)).toEqual([
		'commander.missingMandatoryOptionValue',
		'commander.missingMandatoryOptionValue',
		'commander.missingArgument',
		'commander.unknownOption'
	]);
	expect(refused.map(({ stop }) => stop.message)).toEqual([
		"error: required option '--policy <module>' not specified",
		"error: required option '--data <directory>' not specified",
		"error: missing required argument 'path'",
		"error: unknown option '--bogus'"
	]);
	recordExampleCases(
		{
			unitId: 'command.console',
			symbol: 'registerConsoleCommand',
			state: 'registerconsolecommand-left-subcommand-help-and-refused-inpu',
			evidence: 'examples-cases',
			file: 'registerconsolecommand-left-subcommand-help-and-refused-inpu.json'
		},
		[
			outcome('console with --help', ['console', '--help'], consoleHelp),
			outcome('install with --help', ['console', 'install', '--help'], installHelp),
			outcome('install without --policy', ['console', 'install', '--host', 'site'], noPolicy),
			outcome('objects without --data', ['console', 'objects'], noData),
			outcome('restore without its path', ['console', 'restore', '--host', 'site'], noPath),
			outcome(
				'uninstall with an unknown option',
				['console', 'uninstall', '--host', 'site', '--bogus'],
				bogus
			)
		]
	);
});
