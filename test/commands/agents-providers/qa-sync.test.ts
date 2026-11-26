import { Command } from 'commander';
import { expect, test } from 'vitest';
import { QaSyncCommand } from '../../../src/commands/agents-providers/QaSyncCommand';

test('QaSyncCommand registers a config-driven qa-sync command', () => {
	const program = new Command();
	new QaSyncCommand().register(program);
	const [command] = program.commands;
	expect(command.name()).toBe('qa-sync');
	expect(command.options.map((option) => option.long)).toEqual(
		expect.arrayContaining(['--config', '--dry-run', '--watch', '--slack-token-file'])
	);
});
