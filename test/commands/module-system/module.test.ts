import { Command } from 'commander';
import { expect, test } from 'vitest';
import { ModuleCommand } from '../../../src/commands/module-system/ModuleCommand';

test('module command exposes discovery, installation and resource generators', () => {
	const program = new Command();
	new ModuleCommand().register(program);
	const module = program.commands.find((command) => command.name() === 'module');
	const plugin = program.commands.find((command) => command.name() === 'plugin');
	expect(plugin?.commands.map((command) => command.name())).toEqual([
		'list',
		'info',
		'add',
		'generate',
		'test'
	]);
	expect(module?.commands.map((command) => command.name())).toEqual([
		'list',
		'info',
		'add',
		'generate'
	]);
});
