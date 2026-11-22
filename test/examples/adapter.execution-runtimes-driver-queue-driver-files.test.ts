import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import {
	driverJobType,
	driverJson,
	driverProcesses,
	livePid
} from '../../src/adapters/execution-runtimes/driver-queue/driverFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function installFakePs(directory: string): string {
	const bin = join(directory, 'bin');
	const lines = [
		[
			'/usr/bin/python /fixture/driver/code_task.py',
			'--model model-a --tasks-file /fixture/driver/tasks.json',
			'--wave wave-4 --slot 7'
		].join(' '),
		[
			'/usr/bin/python /fixture/other/code_task.py',
			'--model model-b --tasks-file /fixture/other/tasks.json',
			'--wave wave-5 --slot 2'
		].join(' '),
		[
			'/usr/bin/python /fixture/driver/code_task.py',
			'--model incomplete --tasks-file /fixture/driver/incomplete.json',
			'--wave wave-6'
		].join(' ')
	];
	mkdirSync(bin);
	const executable = join(bin, 'ps');
	writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${lines.join("' '")}'\n`);
	chmodSync(executable, 0o700);
	return bin;
}

function readDriverProcesses(bin: string) {
	vi.stubEnv('PATH', bin);
	try {
		return { scoped: driverProcesses('/fixture/driver'), unscoped: driverProcesses() };
	} finally {
		vi.unstubAllEnvs();
	}
}

test('Reads existing and missing driver JSON snapshots', async () => {
	await withTempDir('driver-files-json-', (directory) => {
		const snapshotPath = join(directory, 'active.json');
		const missingPath = join(directory, 'missing.json');
		const malformedPath = join(directory, 'malformed.json');
		const snapshot = { slot: 4, phase: 'running', summary: 'Fixture task' };
		const snapshotText = JSON.stringify(snapshot);
		const fallback = { jobs: [], source: 'fallback' };
		writeFileSync(snapshotPath, snapshotText);
		writeFileSync(malformedPath, '{invalid');

		const parsed = driverJson(snapshotPath, fallback);
		const missing = driverJson(missingPath, fallback);
		let malformedError: unknown;
		try {
			driverJson(malformedPath, fallback);
		} catch (error) {
			malformedError = error;
		}

		expect(parsed).toEqual(snapshot);
		expect(missing).toBe(fallback);
		expect(malformedError).toBeInstanceOf(SyntaxError);
		expect(readFileSync(snapshotPath, 'utf8')).toBe(snapshotText);
		recordExampleCases(
			{
				unitId: 'adapter.execution-runtimes-driver-queue-driver-files',
				symbol: 'driverJson',
				state: 'reads-existing-and-missing-driver-json-snapshots',
				evidence: 'examples-cases',
				file: 'reads-existing-and-missing-driver-json-snapshots.json'
			},
			[
				{
					name: 'valid snapshot returns parsed task data',
					input: { path: snapshotPath, fallback },
					output: parsed
				},
				{
					name: 'missing snapshot returns the caller fallback',
					input: { path: missingPath, fallback },
					output: missing
				},
				{
					name: 'malformed existing snapshot propagates a syntax error',
					input: { path: malformedPath, fallback },
					error: { name: 'SyntaxError' }
				}
			]
		);
	});
});

test('Extracts live driver process metadata', async () => {
	await withTempDir('driver-files-ps-', (directory) => {
		const { scoped, unscoped } = readDriverProcesses(installFakePs(directory));

		expect(scoped).toEqual([
			{
				model: 'model-a',
				tasksFile: '/fixture/driver/tasks.json',
				wave: 'wave-4',
				slot: '7'
			}
		]);
		expect(unscoped).toEqual([
			{
				model: 'model-a',
				tasksFile: '/fixture/driver/tasks.json',
				wave: 'wave-4',
				slot: '7'
			},
			{
				model: 'model-b',
				tasksFile: '/fixture/other/tasks.json',
				wave: 'wave-5',
				slot: '2'
			}
		]);
		recordExampleCases(
			{
				unitId: 'adapter.execution-runtimes-driver-queue-driver-files',
				symbol: 'driverProcesses',
				state: 'extracts-live-driver-process-metadata',
				evidence: 'examples-cases',
				file: 'extracts-live-driver-process-metadata.json'
			},
			[
				{
					name: 'root filters slots to its driver directory',
					input: { root: '/fixture/driver' },
					output: scoped
				},
				{
					name: 'omitted root includes complete slots from every directory',
					input: {},
					output: unscoped
				}
			]
		);
	});
});

test('Checks driver process liveness', () => {
	const withoutPid = livePid();
	const currentPid = livePid(process.pid);
	const zeroPid = livePid(0);
	expect([withoutPid, currentPid, zeroPid]).toEqual([false, true, false]);
	recordExampleCases(
		{
			unitId: 'adapter.execution-runtimes-driver-queue-driver-files',
			symbol: 'livePid',
			state: 'checks-driver-process-liveness',
			evidence: 'examples-cases',
			file: 'checks-driver-process-liveness.json'
		},
		[
			{ name: 'omitted process id is not alive', input: {}, output: withoutPid },
			{
				name: 'current process accepts signal zero',
				input: { pid: process.pid },
				output: currentPid
			},
			{ name: 'zero process id is rejected', input: { pid: 0 }, output: zeroPid }
		]
	);
});

test('Classifies primary driver job phases', () => {
	const cases = [
		{ name: 'reverify plan', input: 'reverify-driver-queue', output: driverJobType('reverify-driver-queue') },
		{ name: 'contract task', input: 'p1-contract-check', output: driverJobType('p1-contract-check') },
		{ name: 'stub task', input: 'p2a-stub-generation', output: driverJobType('p2a-stub-generation') },
		{ name: 'smell task', input: 'p2b-smell-review', output: driverJobType('p2b-smell-review') }
	];
	expect(cases.map(({ output }) => output)).toEqual(['reverify', 'contract', 'stub', 'smell']);
	recordExampleCases(
		{
			unitId: 'adapter.execution-runtimes-driver-queue-driver-files',
			symbol: 'driverJobType',
			state: 'classifies-primary-driver-job-phases',
			evidence: 'examples-cases',
			file: 'classifies-primary-driver-job-phases.json'
		},
		cases
	);
});

test('Classifies remaining driver job phases', () => {
	const cases = [
		{ name: 'video capture task', input: 'video-capture-report', output: driverJobType('video-capture-report') },
		{ name: 'component task', input: 'w3-component-catalog', output: driverJobType('w3-component-catalog') },
		{ name: 'unmatched task uses code phase', input: 'general-queue-task', output: driverJobType('general-queue-task') }
	];
	expect(cases.map(({ output }) => output)).toEqual(['video', 'component', 'code']);
	recordExampleCases(
		{
			unitId: 'adapter.execution-runtimes-driver-queue-driver-files',
			symbol: 'driverJobType',
			state: 'classifies-remaining-driver-job-phases',
			evidence: 'examples-cases',
			file: 'classifies-remaining-driver-job-phases.json'
		},
		cases
	);
});
