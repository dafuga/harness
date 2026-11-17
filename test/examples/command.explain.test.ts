import { Command } from 'commander';
import { test } from 'vitest';
import { registerExplainCommand } from '../../src/cli/program/ExplainCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const rangeOptions = ['--base <revision>', '--head <revision>'];

const expectedTree = [
	{
		name: 'explain',
		description: 'Record why each changed function or unit changed, and what was tried.',
		options: [],
		subcommands: [
			{
				name: 'add',
				description: 'Record a reason bound to the exact content of the change.',
				options: [
					...rangeOptions,
					'--unit <id>',
					'--symbol <name>',
					'--all',
					'--replace',
					'--behavior <text>',
					'--simplification <text>',
					'--simplification-outcome <outcome>',
					'--performance <text>',
					'--performance-outcome <outcome>'
				],
				subcommands: []
			},
			{
				name: 'list',
				description: 'List the changes that need a reason and whether each has one.',
				options: [...rangeOptions, '--json'],
				subcommands: []
			},
			{
				name: 'check',
				description: 'Fail when a changed function or unit has no current reason.',
				options: [...rangeOptions],
				subcommands: []
			}
		]
	}
];

function describeCommand(command: Command): unknown {
	return {
		name: command.name(),
		description: command.description(),
		options: command.options.map((option) => option.flags),
		subcommands: command.commands.map((subcommand) => describeCommand(subcommand))
	};
}

test('Registers the explain add, list and check commands', () => {
	const program = new Command().name('harness');
	registerExplainCommand(program);
	const registered = program.commands.map((command) => describeCommand(command));

	expect(program.commands.map((command) => command.name())).toEqual(['explain']);
	expect(registered).toEqual(expectedTree);
	recordExampleCases(
		{
			unitId: 'command.explain',
			symbol: 'registerExplainCommand',
			state: 'registers-the-explain-add-list-and-check-commands',
			evidence: 'examples-cases',
			file: 'registers-the-explain-add-list-and-check-commands.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					programCommands: program.commands.map((command) => command.name()),
					registered
				}
			}
		]
	);
});
