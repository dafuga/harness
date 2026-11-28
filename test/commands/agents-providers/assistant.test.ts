import { Command } from 'commander';
import { expect, test } from 'vitest';
import { AssistantCommand } from '../../../src/commands/agents-providers/AssistantCommand';

test('AssistantCommand has an offline check and requires credentials to run', () => {
	const program = new Command();
	new AssistantCommand().register(program);
	const [assistant] = program.commands;
	const [check, run] = assistant.commands;
	expect([assistant.name(), check.name(), run.name()]).toEqual(['assistant', 'check', 'run']);
	expect(check.options.map(({ long }) => long)).toEqual(['--config']);
	expect(run.options.filter(({ mandatory }) => mandatory).map(({ long }) => long)).toEqual([
		'--config',
		'--credentials'
	]);
});
