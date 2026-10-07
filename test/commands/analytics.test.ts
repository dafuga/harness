import { expect, test } from 'vitest';
import { Command } from 'commander';
import { registerAnalyticsCommand } from '../../src/commands/AnalyticsCommand';
test('analytics exposes all query and import/export operations', () => {
	const program = new Command();
	registerAnalyticsCommand(program);
	expect(program.commands[0].commands.map((command) => command.name())).toEqual([
		'summary',
		'loops',
		'jev',
		'models',
		'events',
		'import',
		'export'
	]);
});
