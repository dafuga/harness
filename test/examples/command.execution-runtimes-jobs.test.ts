import type { CommandShape } from './command.execution-runtimes-jobs.test.types';
import { Command, type Option } from 'commander';
import { test, vi } from 'vitest';
import { JobsCommand } from '../../src/commands/execution-runtimes/JobsCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function optionShape(option: Option): CommandShape['options'][number] {
	return {
		flags: option.flags,
		default: option.defaultValue === undefined ? null : String(option.defaultValue)
	};
}

function commandShape(command: Command): CommandShape {
	return {
		name: command.name(),
		description: command.description() ?? '',
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map(optionShape),
		commands: command.commands.map(commandShape)
	};
}

test('register deferred jobs commands without executing work', () => {
	const program = new Command().name('harness');
	program.command('resources');
	const logger = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	let returned: void;
	let writes: string[] = [];
	try {
		returned = new JobsCommand().register(program);
		writes = logger.mock.calls.map((values) => values.map(String).join(' '));
	} finally {
		logger.mockRestore();
	}
	const jobs = program.commands.find((command) => command.name() === 'jobs');
	if (!jobs) throw new Error('JobsCommand.register did not add the jobs command');
	const tree = commandShape(jobs);
	const output = {
		returnedUndefined: returned === undefined,
		rootCommands: program.commands.map((command) => command.name()),
		jobs: tree,
		loggedDuringRegistration: writes
	};

	expect(output.returnedUndefined).toBe(true);
	expect(output.rootCommands).toEqual(['resources', 'jobs']);
	expect(tree.commands.map((command) => command.name)).toEqual([
		'stats',
		'active',
		'eta',
		'record',
		'backfill'
	]);
	expect(
		tree.commands.find((command) => command.name === 'record')?.commands.map(({ name }) => name)
	).toEqual(['start', 'end']);
	expect(writes).toEqual([]);

	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs',
			symbol: 'JobsCommand.register',
			state: 'register-deferred-jobs-commands-without-executing-work',
			evidence: 'examples-cases',
			file: 'register-deferred-jobs-commands-without-executing-work.json'
		},
		[
			{
				name: 'a harness program that already registered resources',
				input: { program: 'harness', existingCommands: ['resources'] },
				output
			}
		]
	);
});
