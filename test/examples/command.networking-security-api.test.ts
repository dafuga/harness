import { Command } from 'commander';
import { test } from 'vitest';
import { ApiCommand } from '../../src/commands/networking-security/ApiCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Registers the API command tree', () => {
	const program = new Command().name('harness');
	new ApiCommand().register(program);
	const api = program.commands.find((command) => command.name() === 'api');
	const commands = api?.commands.map((command) => ({
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => argument.name()),
		options: command.options.map((option) => option.flags),
		subcommands: command.commands.map((subcommand) => subcommand.name())
	}));

	expect(api?.name()).toBe('api');
	expect(commands?.map((command) => command.name)).toEqual([
		'permissions',
		'resources',
		'connect',
		'get',
		'request',
		'call',
		'screenshot',
		'contracts',
		'agents'
	]);
	recordExampleCases(
		{
			unitId: 'command.networking-security-api',
			symbol: 'ApiCommand.register',
			state: 'registers-the-api-command-tree',
			evidence: 'examples-cases',
			file: 'registers-the-api-command-tree.json'
		},
		[
			{
				name: 'a Harness program registering the API command',
				input: { program: 'harness', existingCommands: [] },
				output: { api: api?.name(), commands }
			}
		]
	);
});
