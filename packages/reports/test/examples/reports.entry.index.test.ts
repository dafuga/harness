import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { EntryRun } from './reports.entry.index.test.types';

// Runs the entry script once with a stubbed ReportCommandService. The stub answers
// with `behaviour`, so no repository, file or process is touched.
async function runEntry(
	argv: string[],
	behaviour: (received: string[]) => unknown
): Promise<EntryRun> {
	const seen: string[][] = [];
	const stdout: string[] = [];
	const stderr: string[] = [];
	const originalArgv = process.argv;
	const originalExitCode = process.exitCode;
	vi.resetModules();
	vi.doMock('../../src/services/reports-media/report-command-service/ReportCommandService', () => ({
		ReportCommandService: class {
			execute(received: string[]) {
				seen.push(received);
				return behaviour(received);
			}
		}
	}));
	const log = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
		stdout.push(String(line));
	});
	const error = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
		stderr.push(String(line));
	});
	process.argv = ['node', 'index.ts', ...argv];
	process.exitCode = undefined;
	try {
		await import('../../src/cli/index');
		return { argv: seen[0] ?? [], stdout, stderr, exitCode: process.exitCode };
	} finally {
		process.argv = originalArgv;
		process.exitCode = originalExitCode;
		log.mockRestore();
		error.mockRestore();
		vi.doUnmock('../../src/services/reports-media/report-command-service/ReportCommandService');
	}
}

const beginArgv = ['begin', '--project', 'demo'];
const finalizeArgv = ['finalize', '--run', 'run-3'];
const usageMessage =
	'Usage: report <begin|record|finalize|import|serve|stop|cleanup|sync-storage> [options]';

test('Prints the run id and state of a started report', async () => {
	const run = await runEntry(beginArgv, () => ({ id: 'run-1', state: 'open' }));
	const printed = JSON.parse(run.stdout[0] ?? 'null');
	expect(run.argv).toEqual(beginArgv);
	expect(run.stdout).toHaveLength(1);
	expect(printed).toEqual({ run: 'run-1', state: 'open' });
	expect(run.stderr).toEqual([]);
	expect(run.exitCode).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'reports.entry.index',
			symbol: 'default',
			state: 'prints-the-run-id-and-state-of-a-started-report',
			evidence: 'examples-cases',
			file: 'prints-the-run-id-and-state-of-a-started-report.json'
		},
		[{ name: 'begin prints run and state', input: run.argv, output: printed }]
	);
});

test('Fails the process when the command result lists errors', async () => {
	const run = await runEntry(finalizeArgv, () => ({
		id: 'run-3',
		state: 'sealed',
		errors: ['missing finding']
	}));
	const printed = JSON.parse(run.stdout[0] ?? 'null');
	expect(run.argv).toEqual(finalizeArgv);
	expect(printed).toEqual({ run: 'run-3', state: 'sealed' });
	expect(run.exitCode).toBe(1);
	recordExampleCases(
		{
			unitId: 'reports.entry.index',
			symbol: 'default',
			state: 'fails-the-process-when-the-command-result-lists-errors',
			evidence: 'examples-cases',
			file: 'fails-the-process-when-the-command-result-lists-errors.json'
		},
		[{ name: 'finalize with errors exits 1', input: run.argv, output: printed }]
	);
});

test('Prints a thrown command error to stderr and sets exit code 1', async () => {
	const unknown = await runEntry(['bogus'], () => {
		throw new Error(usageMessage);
	});
	const notAnError = { code: 7 };
	const opaque = await runEntry(['begin'], () => {
		throw notAnError;
	});
	expect(unknown.stdout).toEqual([]);
	expect(unknown.stderr).toEqual([usageMessage]);
	expect(unknown.exitCode).toBe(1);
	expect(opaque.stderr).toEqual(['Report command failed']);
	expect(opaque.exitCode).toBe(1);
	recordExampleCases(
		{
			unitId: 'reports.entry.index',
			symbol: 'default',
			state: 'prints-a-thrown-command-error-to-stderr-and-sets-exit-code-1',
			evidence: 'examples-cases',
			file: 'prints-a-thrown-command-error-to-stderr-and-sets-exit-code-1.json'
		},
		[
			{
				name: 'unknown operation prints usage',
				input: unknown.argv,
				error: { message: usageMessage, exitCode: 1 }
			},
			{
				name: 'non-Error throw prints generic message',
				input: opaque.argv,
				error: { message: 'Report command failed', exitCode: 1 }
			}
		]
	);
});
