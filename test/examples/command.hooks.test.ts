import { Command } from 'commander';
import { test } from 'vitest';
import { registerHooksCommand } from '../../src/cli/program/HooksCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Registers the hooks command tree', () => {
	const program = new Command().name('harness');
	const hooks = registerHooksCommand(program);
	const commands = hooks.commands.map((command) => ({
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map((option) => option.flags)
	}));

	expect(hooks.name()).toBe('hooks');
	expect(program.commands).toContain(hooks);
	expect(commands).toEqual([
		{ name: 'install', arguments: [], options: ['--json', '--command <command>'] },
		{ name: 'uninstall', arguments: [], options: ['--json'] },
		{ name: 'status', arguments: [], options: ['--json'] },
		{
			name: 'run',
			arguments: [
				{ name: 'stage', required: true },
				{ name: 'file', required: false }
			],
			options: []
		}
	]);
	recordExampleCases(
		{
			unitId: 'command.hooks',
			symbol: 'registerHooksCommand',
			state: 'registers-the-hooks-command-tree',
			evidence: 'examples-cases',
			file: 'registers-the-hooks-command-tree.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					returnedCommand: hooks.name(),
					programCommands: program.commands.map((command) => command.name()),
					commands
				}
			}
		]
	);
});
