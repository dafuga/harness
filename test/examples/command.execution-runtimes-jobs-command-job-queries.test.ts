import { Command } from 'commander';
import { test } from 'vitest';
import { registerJobQueries } from '../../src/commands/execution-runtimes/jobs-command/jobQueries';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const EXPECTED_COMMANDS = [
	{
		name: 'stats',
		arguments: 0,
		options: ['--home <path>', '--type <type>', '--model <model>', '--json']
	},
	{
		name: 'active',
		arguments: 0,
		options: ['--status-dir <path>', '--driver-root <path>', '--json', '--markdown']
	},
	{
		name: 'eta',
		arguments: 0,
		options: [
			'--home <path>',
			'--status-dir <path>',
			'--driver-root <path>',
			'--what-if <count|all-modules>',
			'--type <type>',
			'--model <model>',
			'--slots <model=count,...>',
			'--queue <json-file>',
			'--project <path>',
			'--json'
		]
	}
];

test('Registers the stats, active and eta job commands', () => {
	const program = new Command().name('harness');
	const jobs = program.command('jobs');
	registerJobQueries(jobs);
	const commands = jobs.commands.map((command) => ({
		name: command.name(),
		arguments: command.registeredArguments.length,
		options: command.options.map((option) => option.flags)
	}));

	expect(jobs.name()).toBe('jobs');
	expect(commands).toEqual(EXPECTED_COMMANDS);
	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs-command-job-queries',
			symbol: 'registerJobQueries',
			state: 'registers-the-stats-active-and-eta-job-commands',
			evidence: 'examples-cases',
			file: 'registers-the-stats-active-and-eta-job-commands.json'
		},
		[
			{
				name: 'a jobs group with no existing subcommands',
				input: { program: 'harness', jobs: 'jobs' },
				output: { commandName: jobs.name(), commands }
			}
		]
	);
});
