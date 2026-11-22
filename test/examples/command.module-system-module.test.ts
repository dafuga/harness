import { Command } from 'commander';
import { test } from 'vitest';
import { ModuleCommand } from '../../src/commands/module-system/ModuleCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
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

async function runMissingCommand(directory: string, args: string[]) {
	const previous = process.cwd();
	process.chdir(directory);
	try {
		const program = new Command().name('harness');
		new ModuleCommand().register(program);
		await program.parseAsync(['node', 'harness', ...args]);
		return { name: '', message: '' };
	} catch (error) {
		return {
			name: error instanceof Error ? error.name : 'unknown',
			message: error instanceof Error ? error.message : String(error)
		};
	} finally {
		process.chdir(previous);
	}
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

test('Throws Error when a module or plugin id is missing', async () => {
	await withTempDir('module-command-error-', async (directory) => {
		const inputs = [
			{ command: ['module', 'add', 'missing-plugin'] },
			{ command: ['module', 'generate', 'missing-plugin', 'component', 'Example'] },
			{ command: ['module', 'info', 'missing-module'] },
			{ command: ['plugin', 'info', 'missing-plugin'] }
		];
		const outputs: Array<{ name: string; message: string }> = [];
		for (const { command } of inputs) outputs.push(await runMissingCommand(directory, command));
		expect(outputs.map((output) => output.message)).toEqual([
			'Unknown plugin: missing-plugin',
			'Unknown plugin: missing-plugin',
			'Unknown module: missing-module',
			'Unknown module: missing-plugin'
		]);
		expect(outputs.every((output) => output.name.length > 0)).toBe(true);
		recordExampleCases(
			{
				unitId: 'command.module-system-module',
				symbol: 'ModuleCommand.register',
				state: 'throws-error-when-a-module-or-plugin-id-is-missing',
				evidence: 'examples-cases',
				file: 'throws-error-when-a-module-or-plugin-id-is-missing.json'
			},
			inputs.map((input, index) => ({
				name: `rejects ${input.command.join(' ')}`,
				input,
				output: outputs[index]
			}))
		);
	});
});
