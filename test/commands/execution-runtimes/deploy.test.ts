import { Command } from 'commander';
import { expect, test } from 'vitest';
import { DeployCommand } from '../../../src/commands/execution-runtimes/DeployCommand';

test('exposes one-target deploy, read-only planning and guarded recovery', () => {
	const program = new Command();
	new DeployCommand().register(program);
	const command = program.commands[0];
	expect(command.name()).toBe('deploy');
	expect(command.options.map((option) => option.long)).toContain('--plan');
	expect(command.commands.map((item) => item.name())).toEqual([
		'prepare',
		'status',
		'signoff',
		'resume',
		'rollback'
	]);
});
