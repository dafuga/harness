import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { runIsolated } from '../../src/utils/reports-media/run-isolated/runIsolated';
import type { IsolatedRun } from '../../src/utils/reports-media/run-isolated/runIsolated.types';

test('Runs a successful command and records its captured log', async () => {
	await withTempDir('run-isolated-example-', async (directory) => {
		const run = {
			command: '/usr/bin/true',
			args: [],
			cwd: directory,
			env: { CI: 'true' },
			timeoutMs: 30000,
			log: `${directory}/artifacts/isolated/true.log`,
			maxLogBytes: 1048576
		} satisfies IsolatedRun;
		const result = await runIsolated(run);
		const summary = {
			status: result.status,
			exitCode: result.exitCode,
			timedOut: result.timedOut,
			log: result.log,
			survivors: result.survivors,
			stopped: result.stopped,
			resisted: result.resisted,
			unknown: result.unknown
		};
		expect(summary).toMatchObject({
			status: 'passed',
			exitCode: 0,
			timedOut: false,
			log: { path: run.log, bytes: 0 },
			survivors: [],
			unknown: false
		});
		recordExampleCases(
			{
				unitId: 'function.run-isolated',
				symbol: 'runIsolated',
				state: 'runs-a-successful-command-and-records-its-captured-log',
				evidence: 'examples-cases',
				file: 'runs-a-successful-command-and-records-its-captured-log.json'
			},
			[{ name: 'empty successful command', input: run, output: summary }]
		);
	});
});
