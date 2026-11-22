import { Command, CommanderError } from 'commander';
import { beforeEach, test, vi } from 'vitest';
import { registerReportCommand } from '../../src/cli/program/ReportCommand';
import { runReport } from '../../src/cli/program/run-report/runReport';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * registerReportCommand is called on a program the way buildProgram calls it, and each example parses
 * argv against that program the way the CLI does. Output is captured and exits are thrown rather than
 * made. runReport is the one stubbed dependency: the real one starts the reports CLI in a child process
 * and reads the report settings from the home folder, so no example may reach it. The stub records the
 * arguments the action passes to it. Registration stores nothing, so no temporary directory is needed.
 */

vi.mock('../../src/cli/program/run-report/runReport', () => ({
	runReport: vi.fn(() => Promise.resolve())
}));

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
type Written = { stdout: string[]; stderr: string[] };
type Dispatched = { calls: string[][]; stop?: CommanderError; written: Written };
type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean; variadic: boolean }>;
	options: string[];
	commands: string[];
};

beforeEach(() => {
	vi.mocked(runReport).mockClear();
});

/** A program named as buildProgram names it, with its output captured and its exits thrown. */
function harnessProgram(written: Written): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => {
				written.stdout.push(text);
			},
			writeErr: (text) => {
				written.stderr.push(text);
			},
			getOutHelpWidth: () => 80,
			getErrHelpWidth: () => 80
		});
}

/** The report subcommand of a program, once registerReportCommand has added it. */
function reportOf(program: Command): Command {
	const found = program.commands.find((command) => command.name() === 'report');
	if (!found) throw new Error(`${program.name()} has no report subcommand`);
	return found;
}

/** A command as its callers read it: its name, description, arguments, options and subcommands. */
function described(command: Command): Described {
	return {
		name: command.name(),
		description: command.description(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required,
			variadic: argument.variadic
		})),
		options: command.options.map((option) => option.flags),
		commands: command.commands.map((subcommand) => subcommand.name())
	};
}

/** The argument array of each runReport call since the stub was cleared, as the action passed it. */
function runCalls(): string[][] {
	return vi.mocked(runReport).mock.calls.map(([args]) => args);
}

/** Registers the report command on a fresh program, then parses argv against it as the CLI does. */
async function dispatch(argv: string[]): Promise<Dispatched> {
	vi.mocked(runReport).mockClear();
	const written: Written = { stdout: [], stderr: [] };
	const program = harnessProgram(written);
	registerReportCommand(program);
	try {
		await program.parseAsync(argv, { from: 'user' });
	} catch (error) {
		if (!(error instanceof CommanderError)) throw error;
		return { calls: runCalls(), stop: error, written };
	}
	return { calls: runCalls(), written };
}

/** One dispatch as a recorded case: the arguments runReport received, or for help, what was printed. */
function outcome(name: string, argv: string[], run: Dispatched): ExampleCase {
	if (!run.stop) return { name, input: { argv }, output: { runReportArgs: run.calls } };
	return {
		name,
		input: { argv },
		output: {
			stopped: run.stop.code,
			exitCode: run.stop.exitCode,
			help: run.written.stdout.join('').trimEnd().split('\n'),
			runReportArgs: run.calls
		}
	};
}

test('registerReportCommand added the report command', () => {
	const alone = harnessProgram({ stdout: [], stderr: [] });
	const beside = harnessProgram({ stdout: [], stderr: [] });
	beside.command('status');
	const returned = registerReportCommand(alone);
	registerReportCommand(beside);
	const report = reportOf(alone);
	expect(returned).toBeUndefined();
	expect(described(report)).toEqual({
		name: 'report',
		description: 'Record media reports and serve the website.',
		arguments: [{ name: 'args', required: false, variadic: true }],
		options: [],
		commands: []
	});
	expect(alone.commands.map((command) => command.name())).toEqual(['report']);
	expect(beside.commands.map((command) => command.name())).toEqual(['status', 'report']);
	expect(vi.mocked(runReport).mock.calls).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.report',
			symbol: 'registerReportCommand',
			state: 'registerreportcommand-added-the-report-command',
			evidence: 'examples-cases',
			file: 'registerreportcommand-added-the-report-command.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					returned: typeof returned,
					report: described(report),
					programCommands: alone.commands.map((command) => command.name())
				}
			},
			{
				name: 'a harness program that already has a status command',
				input: { program: 'harness', existingCommands: ['status'] },
				output: {
					returned: typeof returned,
					report: described(reportOf(beside)),
					programCommands: beside.commands.map((command) => command.name())
				}
			}
		]
	);
});

test('running report hands its args to runReport', async () => {
	const bare = await dispatch(['report']);
	const clip = await dispatch(['report', 'record', 'clip.mp4']);
	const titled = await dispatch(['report', 'record', '--title', 'Launch clip']);
	const help = await dispatch(['report', '--help']);
	expect(bare.calls).toEqual([[]]);
	expect(clip.calls).toEqual([['record', 'clip.mp4']]);
	expect(titled.calls).toEqual([['record', '--title', 'Launch clip']]);
	expect(help.stop?.code).toBe('commander.helpDisplayed');
	expect(help.calls).toEqual([]);
	expect(help.written.stdout.join('')).toContain('Usage: harness report [options] [args...]');
	recordExampleCases(
		{
			unitId: 'command.report',
			symbol: 'registerReportCommand',
			state: 'running-report-hands-its-args-to-runreport',
			evidence: 'examples-cases',
			file: 'running-report-hands-its-args-to-runreport.json'
		},
		[
			outcome('bare report', ['report'], bare),
			outcome('report with two arguments', ['report', 'record', 'clip.mp4'], clip),
			outcome(
				'report with an option the harness does not know',
				['report', 'record', '--title', 'Launch clip'],
				titled
			),
			outcome('report --help', ['report', '--help'], help)
		]
	);
});
