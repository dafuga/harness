import type { CommandShape } from './command.benchmark.test.types';
import { Command, type Option } from 'commander';
import { test } from 'vitest';
import { registerBenchmarkCommand } from '../../src/cli/program/BenchmarkCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function optionShape(option: Option): { flags: string } {
	return { flags: option.flags };
}

function commandShape(command: Command): CommandShape {
	return {
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map(optionShape),
		commands: command.commands.map(commandShape)
	};
}

function registeredCommand(program: Command, name: string): Command {
	const command = program.commands.find((entry) => entry.name() === name);
	if (!command) throw new Error(`Expected ${name} command to be registered.`);
	return command;
}

test('registers benchmark command tree', () => {
	const program = new Command().name('harness');
	program.command('status');
	const returned = registerBenchmarkCommand(program);
	const benchmark = registeredCommand(program, 'benchmark');
	expect(returned).toBeUndefined();
	expect(program.commands.map((command) => command.name())).toEqual(['status', 'benchmark']);
	const tree = commandShape(benchmark);
	const child = (name: string): CommandShape => ({
		name,
		arguments: [{ name: 'target', required: true }],
		options: [{ flags: '--json' }, { flags: '--seed <seed>' }],
		commands: []
	});
	const expected = {
		name: 'benchmark',
		arguments: [],
		options: [],
		commands: [child('validate'), child('run'), child('results')]
	};
	expect(tree).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'command.benchmark',
			symbol: 'registerBenchmarkCommand',
			state: 'registers-benchmark-command-tree',
			evidence: 'examples-cases',
			file: 'registers-benchmark-command-tree.json'
		},
		[
			{
				name: 'harness program with an existing status command',
				input: { program: 'harness', existingCommands: ['status'] },
				output: {
					returnValue: returned ?? null,
					programCommands: program.commands.map((command) => command.name()),
					benchmark: tree
				}
			}
		]
	);
});
