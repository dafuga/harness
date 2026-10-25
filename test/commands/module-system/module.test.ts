import { TestingPluginService } from '../../../src/commands/module-system/module-command/TestingPluginService';
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

test('testing admission rejects capability modules and headed execution before setup', async () => {
	const testing = new TestingPluginService();
	await expect(testing.run(process.cwd(), 'email')).rejects.toThrow(/testing plugin/);
	await expect(testing.run(process.cwd(), 'headless-audio')).rejects.toThrow(/testing plugin/);
	await expect(testing.run(process.cwd(), 'playwright', ['--headed'])).rejects.toThrow(/headless/);
});
