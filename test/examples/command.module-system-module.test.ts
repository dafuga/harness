import { Command } from 'commander';
import { test } from 'vitest';
import { ModuleCommand } from '../../src/commands/module-system/ModuleCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type CommandShape = {
	name: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: string[];
	commands: CommandShape[];
};

function describeCommand(command: Command): CommandShape {
	return {
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map((option) => option.flags),
		commands: command.commands.map(describeCommand)
	};
}

test('Registers module and plugin command groups', () => {
	const inputs = [
		{ program: 'harness', existingCommands: ['status'] },
		{ program: 'harness', existingCommands: [] }
	];
	const results = inputs.map((input) => {
		const program = new Command().name(input.program);
		for (const name of input.existingCommands) program.command(name);
		const returned = new ModuleCommand().register(program);
		return {
			returned: returned === undefined,
			commands: program.commands.map(describeCommand)
		};
	});
	const moduleCommands = results[0].commands.find((command) => command.name === 'module');
	const pluginCommands = results[0].commands.find((command) => command.name === 'plugin');

	expect(results.map((result) => result.returned)).toEqual([true, true]);
	expect(results.map((result) => result.commands.map((command) => command.name))).toEqual([
		['status', 'module', 'plugin'],
		['module', 'plugin']
	]);
	expect(moduleCommands?.commands.map((command) => command.name)).toEqual([
		'list',
		'info',
		'add',
		'generate'
	]);
	const pluginCommandNames = pluginCommands?.commands.map((command) => command.name) ?? [];
	expect(pluginCommandNames.includes('list')).toBe(true);
	expect(pluginCommandNames.includes('info')).toBe(true);
	expect(pluginCommandNames.includes('test')).toBe(true);
	recordExampleCases(
		{
			unitId: 'command.module-system-module',
			symbol: 'ModuleCommand.register',
			state: 'registers-module-and-plugin-command-groups',
			evidence: 'examples-cases',
			file: 'registers-module-and-plugin-command-groups.json'
		},
		inputs.map((input, index) => ({
			name: `registers command groups beside ${input.existingCommands.join(', ') || 'no existing commands'}`,
			input,
			output: results[index]
		}))
	);
});
