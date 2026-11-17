import { Command } from 'commander';
import { test } from 'vitest';
import { registerNewCommand } from '../../src/cli/program/new';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function describeCommand(command: Command) {
	return {
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map((option) => ({
			flags: option.flags,
			defaultValue: option.defaultValue ?? null
		}))
	};
}

const EXPECTED_SUBCOMMANDS = [
	{
		name: 'app',
		arguments: [{ name: 'name', required: true }],
		options: [{ flags: '--force', defaultValue: null }]
	},
	{
		name: 'game',
		arguments: [{ name: 'name', required: true }],
		options: [
			{ flags: '--force', defaultValue: null },
			{ flags: '--dimension <dimension>', defaultValue: '2d' }
		]
	},
	{
		name: 'lib',
		arguments: [{ name: 'name', required: true }],
		options: [{ flags: '--force', defaultValue: null }]
	}
];

const INVALID_DIMENSION_ARGV = ['new', 'game', 'arcade', '--dimension', '4d'];

function runNewCommand(argv: string[]) {
	const program = new Command().name('harness');
	registerNewCommand(program);
	return program.parseAsync(argv, { from: 'user' });
}

test('Registers the new command tree', () => {
	const program = new Command().name('harness');
	const returned = registerNewCommand(program);
	const newCommand = program.commands.find((command) => command.name() === 'new');
	const subcommands = newCommand?.commands.map((command) => describeCommand(command)) ?? [];

	expect(returned).toBeUndefined();
	expect(program.commands.map((command) => command.name())).toEqual(['new']);
	expect(newCommand).toBeDefined();
	expect(subcommands).toEqual(EXPECTED_SUBCOMMANDS);

	recordExampleCases(
		{
			unitId: 'command.new',
			symbol: 'registerNewCommand',
			state: 'registers-the-new-command-tree',
			evidence: 'examples-cases',
			file: 'registers-the-new-command-tree.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					returnedValue: null,
					programCommands: ['new'],
					subcommands
				}
			}
		]
	);
});

test('Throws ExpectedCliError when game dimension is not 2d or 3d', async () => {
	const failure = await runNewCommand(INVALID_DIMENSION_ARGV).then(
		() => null,
		(error: unknown) => error
	);
	const message = failure instanceof Error ? failure.message : null;

	expect(failure).toBeInstanceOf(Error);
	expect(message).toBe('Dimension must be 2d or 3d.');

	recordExampleCases(
		{
			unitId: 'command.new',
			symbol: 'registerNewCommand',
			state: 'throws-expectedclierror-when-game-dimension-is-not-2d-or-3d',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-game-dimension-is-not-2d-or-3d.json'
		},
		[
			{
				name: 'game command with --dimension 4d',
				input: { argv: INVALID_DIMENSION_ARGV },
				error: { message }
			}
		]
	);
});
