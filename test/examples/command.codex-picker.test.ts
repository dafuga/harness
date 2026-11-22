import { Command } from 'commander';
import { test } from 'vitest';
import { registerCodexPickerCommand } from '../../src/cli/program/codex-picker-command/CodexPickerCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Registers picker subcommands', () => {
	const program = new Command('harness');
	const codex = program.command('codex').description('Local experimental Codex gateway.');
	const result = registerCodexPickerCommand(codex);
	const commands = codex.commands.map((command) => ({
		name: command.name(),
		options: command.options.map((option) => ({
			flags: option.flags,
			mandatory: option.mandatory,
			...(option.defaultValue === undefined ? {} : { default: option.defaultValue })
		}))
	}));

	expect(result).toBeUndefined();
	expect(commands).toEqual([
		{
			name: 'picker-mcp',
			options: [{ flags: '--panel-file <path>', mandatory: true }]
		},
		{
			name: 'picker-preview',
			options: [
				{ flags: '--panel-file <path>', mandatory: true },
				{ flags: '--port <port>', mandatory: false, default: '47839' }
			]
		}
	]);
	// Registration stores only in-memory Commander commands; their actions run on later dispatch.
	recordExampleCases(
		{
			unitId: 'command.codex-picker',
			symbol: 'registerCodexPickerCommand',
			state: 'registers-picker-subcommands',
			evidence: 'examples-cases',
			file: 'registers-picker-subcommands.json'
		},
		[
			{
				name: 'adds both picker commands under codex with required panel files',
				input: { parentCommand: 'codex' },
				output: { returnValue: 'void', commands }
			}
		]
	);
});
