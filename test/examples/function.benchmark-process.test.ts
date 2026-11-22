import { test } from 'vitest';
import type { BenchmarkProcessInput } from '../../src/cli/program/benchmark-service/benchmarkProcess';
import { benchmarkEnvironment, benchmarkProcess } from '../../src/cli/program/benchmark-service/benchmarkProcess';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Benchmark environment disables analytics and keeps its declared variables', () => {
	const environment = benchmarkEnvironment();
	const present = Object.keys(environment).filter((key) => key !== 'HARNESS_ANALYTICS_DISABLED').sort();
	const summary = { analyticsDisabled: environment.HARNESS_ANALYTICS_DISABLED, present };
	expect(summary.analyticsDisabled).toBe('1');
	expect(present.every((key) => ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TEMP', 'LANG', 'TZ', 'SYSTEMROOT'].includes(key))).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.benchmark-process',
			symbol: 'benchmarkEnvironment',
			state: 'benchmark-environment-disables-analytics-and-keeps-its-decla',
			evidence: 'examples-cases',
			file: 'benchmark-environment-disables-analytics-and-keeps-its-decla.json'
		},
		[{ name: 'analytics disabled with available allowlisted variables', input: {}, output: summary }]
	);
});

test('Benchmark process returns child output and nonzero exit codes', async () => {
	await withTempDir('benchmark-process-example-', async (directory) => {
		const success: BenchmarkProcessInput = {
			command: [process.execPath, '-e', "process.stdout.write('trial 5 of 5 complete\\n')"],
			cwd: directory,
			timeoutMs: 5000
		};
		const failure: BenchmarkProcessInput = {
			command: [process.execPath, '-e', "process.stderr.write('fixture not found: evidence-grid\\n'); process.exitCode = 1"],
			cwd: directory,
			timeoutMs: 5000
		};
		const successResult = await benchmarkProcess(success);
		const failureResult = await benchmarkProcess(failure);
		expect(successResult).toEqual({ exitCode: 0, stdout: 'trial 5 of 5 complete\n', stderr: '' });
		expect(failureResult).toEqual({ exitCode: 1, stdout: '', stderr: 'fixture not found: evidence-grid\n' });
		recordExampleCases(
			{
				unitId: 'function.benchmark-process',
				symbol: 'benchmarkProcess',
				state: 'benchmark-process-returns-child-output-and-nonzero-exit-code',
				evidence: 'examples-cases',
				file: 'benchmark-process-returns-child-output-and-nonzero-exit-code.json'
			},
			[
				{ name: 'completed benchmark trial', input: { command: success.command, timeoutMs: success.timeoutMs }, output: successResult },
				{ name: 'missing benchmark fixture', input: { command: failure.command, timeoutMs: failure.timeoutMs }, output: failureResult }
			]
		);
	});
});
