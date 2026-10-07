import { Command } from 'commander';
import { expect, test } from 'vitest';
import { registerCodexCommand } from '../../src/commands/CodexCommand';
test('gateway registration leaves existing defaults alone and requires a token file', () => {
	const program = new Command();
	registerCodexCommand(program);
	const serve = program.commands[0].commands[0];
	expect(serve.name()).toBe('serve');
	expect(serve.options.find((option) => option.long === '--token-file')?.required).toBe(true);
});
