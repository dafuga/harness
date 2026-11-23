import type { Described, OptionDefault } from './command.history.test.types';
import { Command, type Option } from 'commander';
import { test } from 'vitest';
import { registerHistoryCommand } from '../../src/cli/program/HistoryCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const subcommandNames = [
	'attach',
	'status',
	'reasons',
	'prune',
	'fetch',
	'push',
	'sync',
	'build',
	'import-reports'
];

/** A harness program that already holds the named commands. */
function programWith(existing: string[]): Command {
	const program = new Command().name('harness');
	for (const name of existing) program.command(name);
	return program;
}

/** The recording metadata for one state of registerHistoryCommand. */
function recording(state: string): Parameters<typeof recordExampleCases>[0] {
	return {
		unitId: 'command.history',
		symbol: 'registerHistoryCommand',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function inputOf(existingCommands: string[]): unknown {
	return { program: 'harness', existingCommands };
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

function flagsOf(tree: Described, name: string): string[] {
	return subcommand(tree, name).options.map((option) => option.flags);
}

function defaultOf(tree: Described, name: string, flags: string): unknown {
	return subcommand(tree, name).options.find((option) => option.flags === flags)?.default;
}

/** Every option default in the tree, with the subcommand and flags it belongs to. */
function defaultsOf(tree: Described): OptionDefault[] {
	return tree.commands.flatMap((command) =>
		command.options
			.filter((option) => option.default !== undefined)
			.map((option) => ({ command: command.name, flags: option.flags, default: option.default }))
	);
}

/** What came back, and what the program holds afterwards: the history command, not the program. */
function attachedOutput(returned: Command, program: Command): unknown {
	return {
		returned: { name: returned.name(), description: returned.description() },
		returnedIsProgram: returned === program,
		programCommands: program.commands.map((command) => command.name())
	};
}

test('Adds the history command to the program and returns it', () => {
	const alone = programWith([]);
	const beside = programWith(['status']);
	const returned = registerHistoryCommand(alone);
	const returnedBeside = registerHistoryCommand(beside);
	expect(returned.name()).toBe('history');
	expect(returned.description()).toBe(
		'Keep verification records, evidence and reasons in Git, and read them back.'
	);
	expect(returned === alone).toBe(false);
	expect(alone.commands.includes(returned)).toBe(true);
	expect(returnedBeside.name()).toBe('history');
	expect(beside.commands.map((command) => command.name())).toEqual(['status', 'history']);
	recordExampleCases(recording('adds-the-history-command-to-the-program-and-returns-it'), [
		{
			name: 'a harness program with no other commands',
			input: inputOf([]),
			output: attachedOutput(returned, alone)
		},
		{
			name: 'a harness program that already has a status command',
			input: inputOf(['status']),
			output: attachedOutput(returnedBeside, beside)
		}
	]);
});

test('Registers the nine history subcommands in order', () => {
	const alone = programWith([]);
	const beside = programWith(['status']);
	const tree = described(registerHistoryCommand(alone));
	const besideTree = described(registerHistoryCommand(beside));
	expect(tree.commands.map((command) => command.name)).toEqual(subcommandNames);
	expect(besideTree.commands.map((command) => command.name)).toEqual(subcommandNames);
	expect(subcommand(tree, 'fetch').arguments).toEqual([{ name: 'remote', required: false }]);
	expect(subcommand(tree, 'sync').arguments).toEqual([{ name: 'remote', required: false }]);
	expect(flagsOf(tree, 'attach')).toEqual(['--commit <revision>', '--record <id>', '--json']);
	expect(flagsOf(tree, 'prune')).toEqual(['--keep-last <count>', '--older-than <days>', '--json']);
	expect(flagsOf(tree, 'build')).toEqual([
		'--out <directory>',
		'--limit <count>',
		'--strict',
		'--json'
	]);
	expect(flagsOf(tree, 'import-reports')).toEqual([
		'--from <directory>',
		'--project <name>',
		'--json'
	]);
	recordExampleCases(recording('registers-the-nine-history-subcommands-in-order'), [
		{
			name: 'a harness program with no other commands',
			input: inputOf([]),
			output: { subcommands: tree.commands }
		},
		{
			name: 'a harness program that already has a status command',
			input: inputOf(['status']),
			output: { subcommands: besideTree.commands }
		}
	]);
});

test('Defaults --commit to HEAD and --limit to 2000', () => {
	const alone = programWith([]);
	const beside = programWith(['status']);
	const tree = described(registerHistoryCommand(alone));
	const besideTree = described(registerHistoryCommand(beside));
	expect(defaultOf(tree, 'attach', '--commit <revision>')).toBe('HEAD');
	expect(defaultOf(tree, 'status', '--commit <revision>')).toBe('HEAD');
	expect(defaultOf(tree, 'reasons', '--commit <revision>')).toBe('HEAD');
	expect(defaultOf(tree, 'build', '--limit <count>')).toBe('2000');
	expect(defaultsOf(besideTree)).toEqual(defaultsOf(tree));
	recordExampleCases(recording('defaults-commit-to-head-and-limit-to-2000'), [
		{
			name: 'a harness program with no other commands',
			input: inputOf([]),
			output: { defaults: defaultsOf(tree) }
		},
		{
			name: 'a harness program that already has a status command',
			input: inputOf(['status']),
			output: { defaults: defaultsOf(besideTree) }
		}
	]);
});
