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

test('Throws AbortError when the signal is already aborted', async () => {
	const controller = new AbortController();
	controller.abort();
	const run = {
		command: '/usr/bin/true',
		args: [],
		cwd: '/workspace/project',
		env: { CI: 'true' },
		timeoutMs: 30000,
		log: '/workspace/project/aborted.log',
		maxLogBytes: 1024,
		signal: controller.signal
	} satisfies IsolatedRun;
	let thrown: unknown;
	try {
		await runIsolated(run);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toMatchObject({ name: 'AbortError' });
	recordExampleCases(
		{
			unitId: 'function.run-isolated',
			symbol: 'runIsolated',
			state: 'throws-aborterror-when-the-signal-is-already-aborted',
			evidence: 'examples-cases',
			file: 'throws-aborterror-when-the-signal-is-already-aborted.json'
		},
		[
			{
				name: 'default abort reason',
				input: { ...run, signal: 'already aborted' },
				error: { name: 'AbortError' }
			}
		]
	);
});

test('Throws Error when the log parent is a file', async () => {
	await withTempDir('run-isolated-error-', async (directory) => {
		const blocker = `${directory}/log-parent`;
		const { writeFile } = await import('node:fs/promises');
		await writeFile(blocker, 'file');
		const run = {
			command: '/usr/bin/true',
			args: [],
			cwd: directory,
			env: { CI: 'true' },
			timeoutMs: 30000,
			log: `${blocker}/run.log`,
			maxLogBytes: 1024
		} satisfies IsolatedRun;
		let thrown: unknown;
		try {
			await runIsolated(run);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'function.run-isolated',
				symbol: 'runIsolated',
				state: 'throws-error-when-the-log-parent-is-a-file',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-log-parent-is-a-file.json'
			},
			[
				{
					name: 'file blocks recursive log directory creation',
					input: { log: run.log },
					error: { name: 'Error' }
				}
			]
		);
	});
});
