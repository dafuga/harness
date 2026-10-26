import { TestingPluginService } from '../../../src/commands/module-system/module-command/TestingPluginService';
import { Command } from 'commander';
import { expect, test, vi } from 'vitest';
import { ModuleInstallService } from '../../../src/services/module-system/ModuleInstallService';
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
	const setup = vi
		.spyOn(ModuleInstallService.prototype, 'add')
		.mockRejectedValue(new Error('Setup must not run.'));
	try {
		for (const args of [
			['--headed'],
			['--debug'],
			['--ui'],
			['--config=missing.ts'],
			['-c', 'missing.ts'],
			['-cmissing.ts']
		])
			await expect(testing.run(process.cwd(), 'playwright', args)).rejects.toThrow(/headless/);
		expect(setup).not.toHaveBeenCalled();
	} finally {
		setup.mockRestore();
	}
});
