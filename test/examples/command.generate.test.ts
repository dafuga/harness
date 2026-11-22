import { Command, CommanderError, type Option } from 'commander';
import { test } from 'vitest';
import { registerGenerateCommand } from '../../src/cli/program/generate';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { scaffoldKinds } from '../../src/templates/development-tooling/scaffoldTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * registerGenerateCommand is called on a program the way buildProgram calls it. Commander runs an
 * action only when it dispatches to that subcommand, so these examples dispatch only to inputs that
 * stop before any generator writes: help, commander's own refusals, and the --level check. Other
 * actions write into the working directory, so they are not dispatched here. Registration stores
 * nothing, so no temporary directory is needed.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
type Written = { stdout: string[]; stderr: string[] };
type Stop = { argv: string[]; written: Written; error: Error };
type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default?: unknown }>;
	commands: string[];
};

/** A program named as buildProgram names it. Output is captured and exits are thrown, not made. */
function harnessProgram(written: Written): Command {
	return new Command('harness')
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

/** Parses argv against a fresh program and returns what it printed and the error that stopped it. */
async function dispatch(argv: string[]): Promise<Stop> {
	const written: Written = { stdout: [], stderr: [] };
	const program = harnessProgram(written);
	registerGenerateCommand(program);
	const error = await program.parseAsync(argv, { from: 'user' }).then(
		() => new Error(`${argv.join(' ')} ran without a stop`),
		(caught: Error) => caught
	);
	return { argv, written, error };
}

function optionOf(option: Option): Described['options'][number] {
	if (option.defaultValue === undefined) return { flags: option.flags };
	return { flags: option.flags, default: option.defaultValue };
}

/** A command as its callers read it: name, description, arguments, options and subcommand names. */
function described(command: Command): Described {
	return {
		name: command.name(),
		description: command.description(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map(optionOf),
		commands: command.commands.map((subcommand) => subcommand.name())
	};
}

/** The named command that a parent holds, as its callers reach it. */
function child(parent: Command, name: string): Command {
	const found = parent.commands.find((command) => command.name() === name);
	if (!found) throw new Error(`${parent.name()} has no ${name} command`);
	return found;
}

/** What registration left on a program: whether the call returned nothing, and the generate tree. */
function registration(program: Command, returned: unknown) {
	const generate = child(program, 'generate');
	return {
		returnedNothing: returned === undefined,
		programCommands: program.commands.map((command) => command.name()),
		generate: {
			aliases: generate.aliases(),
			subcommands: generate.commands.map((command) => command.name())
		},
		elements: described(child(generate, 'elements')),
		model: described(child(generate, 'model')),
		unit: described(child(generate, 'unit')),
		component: described(child(generate, 'component'))
	};
}

/** A refusal as a case records it: commander's code and exit status when commander stopped it. */
function refusal(error: Error): Record<string, unknown> {
	if (error instanceof CommanderError) {
		const { name, code, exitCode, message } = error;
		return { name, code, exitCode, message };
	}
	return { name: error.name, message: error.message };
}

/** One dispatch as a recorded case: the help commander printed, or the refusal that stopped it. */
function outcome(name: string, { argv, written, error }: Stop): ExampleCase {
	if (error instanceof CommanderError && error.code === 'commander.helpDisplayed') {
		const help = written.stdout.join('').trimEnd().split('\n');
		return { name, input: argv, output: { exitCode: error.exitCode, help } };
	}
	return { name, input: argv, error: refusal(error) };
}

test('Registers the generate tree and its g alias on a program', () => {
	const alone = new Command('harness');
	const beside = new Command('harness');
	beside.command('status');
	const returned: unknown = registerGenerateCommand(alone);
	const besideReturned: unknown = registerGenerateCommand(beside);
	const plain = registration(alone, returned);
	const withStatus = registration(beside, besideReturned);
	expect(plain.returnedNothing).toBe(true);
	expect(withStatus.returnedNothing).toBe(true);
	expect(plain.programCommands).toEqual(['generate']);
	expect(withStatus.programCommands).toEqual(['status', 'generate']);
	expect(plain.generate.aliases).toEqual(['g']);
	expect(plain.generate.subcommands).toEqual(['elements', 'model', 'unit', ...scaffoldKinds]);
	expect(plain.model.options).toContainEqual({ flags: '--adapter <adapter>', default: 'd1' });
	expect(plain.component.options).toContainEqual({ flags: '--level <level>', default: 'molecule' });
	recordExampleCases(
		{
			unitId: 'command.generate',
			symbol: 'registerGenerateCommand',
			state: 'registers-the-generate-tree-and-its-g-alias-on-a-program',
			evidence: 'examples-cases',
			file: 'registers-the-generate-tree-and-its-g-alias-on-a-program.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existing: [] },
				output: plain
			},
			{
				name: 'a harness program that already has a status command',
				input: { program: 'harness', existing: ['status'] },
				output: withStatus
			}
		]
	);
});

test('Shows help and refuses bad input before any action', async () => {
	const generateHelp = await dispatch(['generate', '--help']);
	const componentHelp = await dispatch(['g', 'component', '--help']);
	const missingName = await dispatch(['generate', 'model']);
	const unknownOption = await dispatch(['generate', 'unit', 'Button', '--bogus']);
	const componentText = componentHelp.written.stdout.join('');
	expect(generateHelp.error).toMatchObject({ code: 'commander.helpDisplayed', exitCode: 0 });
	expect(generateHelp.written.stdout.join('')).toContain('Generate Harness code.');
	expect(componentHelp.error).toMatchObject({ code: 'commander.helpDisplayed' });
	expect(componentText).toContain('--level <level>');
	expect(componentText).toContain('(default: "molecule")');
	expect(missingName.error).toMatchObject({
		code: 'commander.missingArgument',
		message: "error: missing required argument 'name'"
	});
	expect(unknownOption.error).toMatchObject({
		code: 'commander.unknownOption',
		message: "error: unknown option '--bogus'"
	});
	recordExampleCases(
		{
			unitId: 'command.generate',
			symbol: 'registerGenerateCommand',
			state: 'shows-help-and-refuses-bad-input-before-any-action',
			evidence: 'examples-cases',
			file: 'shows-help-and-refuses-bad-input-before-any-action.json'
		},
		[
			outcome('generate --help', generateHelp),
			outcome('g component --help', componentHelp),
			outcome('generate model with no name', missingName),
			outcome('generate unit with an unknown option', unknownOption)
		]
	);
});

test('Refuses a component level other than molecule or organism', async () => {
	const atom = await dispatch(['generate', 'component', 'Button', '--level', 'atom']);
	const capital = await dispatch(['g', 'component', 'SearchField', '--level', 'Organism']);
	const template = await dispatch(['generate', 'component', 'Hero', '--level', 'template']);
	const hint = 'Use --level molecule or organism; native atoms come from generate elements.';
	expect(atom.error).toBeInstanceOf(ExpectedCliError);
	expect(atom.error).toMatchObject({ name: 'ExpectedCliError', message: hint });
	expect(capital.error).toMatchObject({ name: 'ExpectedCliError', message: hint });
	expect(template.error).toMatchObject({ name: 'ExpectedCliError', message: hint });
	expect(atom.written.stdout).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.generate',
			symbol: 'registerGenerateCommand',
			state: 'refuses-a-component-level-other-than-molecule-or-organism',
			evidence: 'examples-cases',
			file: 'refuses-a-component-level-other-than-molecule-or-organism.json'
		},
		[
			outcome('component Button with --level atom', atom),
			outcome('g component SearchField with --level Organism', capital),
			outcome('component Hero with --level template', template)
		]
	);
});
