import { expect, test } from 'vitest';
import { Command } from 'commander';
import { registerAnalyticsCommand } from '../../src/cli/program/AnalyticsCommand';
test('analytics exposes all query and import/export operations', () => {
	const program = new Command();
	registerAnalyticsCommand(program);
	expect(program.commands[0].commands.map((command) => command.name())).toEqual([
		'cpu',
		'prune',
		'summary',
		'loops',
		'jev',
		'models',
		'tasks',
		'benchmarks',
		'events',
		'import',
		'export'
	]);
});
