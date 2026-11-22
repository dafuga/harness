import { Command } from 'commander';
import { test } from 'vitest';
import { registerLoopCommand } from '../../src/cli/program/loop';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Registers the loop command tree', () => {
	const program = new Command().name('harness');
	const returnValue = registerLoopCommand(program);

	const loopCommand = program.commands.find((command) => command.name() === 'loop');
	const subcommands =
		loopCommand?.commands.map((command) => {
			const parameters = command.registeredArguments.map((argument) =>
				argument.required ? `<${argument.name()}>` : `[${argument.name()}]`
			);
			return [command.name(), ...parameters].join(' ');
		}) ?? [];
	const expectedSubcommands = [
		'list',
		'close <loop>',
		'record <loop>',
		'create <name>',
		'add <loop> <step>',
		'complete <loop> <step>',
		'status <loop>',
		'search [query]',
		'next <loop>',
		'evaluate <loop>'
	];

	expect(loopCommand?.name()).toBe('loop');
	expect(returnValue).toBeUndefined();
	expect(subcommands).toEqual(expectedSubcommands);
	recordExampleCases(
		{
			unitId: 'command.loop',
			symbol: 'registerLoopCommand',
			state: 'registers-the-loop-command-tree',
			evidence: 'examples-cases',
			file: 'registers-the-loop-command-tree.json'
		},
		[
			{
				name: 'Adds loop lifecycle and work subcommands',
				input: { program: { name: 'harness' } },
				output: {
					returnValue: returnValue ?? null,
					command: loopCommand?.name() ?? null,
					subcommands
				}
			}
		]
	);
});
