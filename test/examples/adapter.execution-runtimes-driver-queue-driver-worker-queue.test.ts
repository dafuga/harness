import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import type { DriverActive } from '../../src/adapters/execution-runtimes/DriverQueueAdapter.types';
import { driverWorkerQueue } from '../../src/adapters/execution-runtimes/driver-queue/driverWorkerQueue';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const tasks = [
	{ id: 'completed-before-cursor', type: 'code' },
	{ id: 'slot-zero-current', type: 'code' },
	{ id: 'completed-pass', type: 'contract' },
	{ id: 'future-contract-retry', type: 'contract' },
	{ id: 'slot-one-current', type: 'code' },
	{ id: 'w3-component-followup' }
];
const results = {
	'completed-pass': { status: 'pass' },
	'future-contract-retry': { status: 'fail' }
};
const activeState: DriverActive = {
	active: [
		{ model: 'luna', task: 'slot-zero-current', slot: '0' },
		{ model: 'luna', task: 'slot-one-current', slot: '1' }
	],
	totals: { planned: 6, done: 2, pass: 1, fail: 1, remaining: 4 },
	reverify_totals: { planned: 0, done: 0, pass: 0, fail: 0, remaining: 0 },
	counts: { luna: 2, haiku: 0, total: 2, reverify: 0 },
	updated: '2026-11-16T08:00:00.000Z'
};
const expectedOutput = {
	queued: [
		{ id: 'future-contract-retry', model: 'luna', type: 'contract' },
		{ id: 'w3-component-followup', model: 'luna', type: 'component' }
	],
	slots: { luna: 2 }
};

function writeQueueFixture(root: string): void {
	const taskDirectory = join(root, 'driver', 'queues');
	mkdirSync(taskDirectory, { recursive: true });
	writeFileSync(join(taskDirectory, 'luna-tasks.json'), JSON.stringify(tasks));
	for (const [taskId, result] of Object.entries(results)) {
		const resultDirectory = join(root, 'results-wave-4', 'luna', taskId);
		mkdirSync(resultDirectory, { recursive: true });
		writeFileSync(join(resultDirectory, 'result.json'), JSON.stringify(result));
	}
}

function writeProcessFixture(root: string): string[] {
	const lines = [
		`/fake/code_task.py --root ${root} --model luna --slot 0 --wave wave-4 --tasks-file queues/luna-tasks.json`,
		`/fake/code_task.py --root ${root} --model luna --slot 1 --wave wave-4 --tasks-file queues/luna-tasks.json`,
		'/fake/code_task.py --root /unrelated-driver --model haiku --slot 0 --wave wave-4 --tasks-file other.json',
		`/fake/other_task.py --root ${root} --model haiku --slot 7 --wave wave-4 --tasks-file ignored.json`
	];
	const binaryDirectory = join(root, 'bin');
	const executable = join(binaryDirectory, 'ps');
	mkdirSync(binaryDirectory, { recursive: true });
	writeFileSync(
		executable,
		`#!/bin/sh\nprintf '%s\\n' ${lines.map((line) => `'${line}'`).join(' ')}\n`
	);
	chmodSync(executable, 0o700);
	return lines;
}

function runWithFakeProcessDiscovery(root: string): ReturnType<typeof driverWorkerQueue> {
	vi.stubEnv('PATH', join(root, 'bin'));
	try {
		return driverWorkerQueue(root, activeState);
	} finally {
		vi.unstubAllEnvs();
	}
}

function runQueueExample(root: string): void {
	writeQueueFixture(root);
	const processLines = writeProcessFixture(root);
	const output = runWithFakeProcessDiscovery(root);
	expect(output).toEqual(expectedOutput);
	recordExampleCases(
		{
			unitId: 'adapter.execution-runtimes-driver-queue-driver-worker-queue',
			symbol: 'driverWorkerQueue',
			state: 'queues-retryable-work-after-each-live-slot-cursor',
			evidence: 'examples-cases',
			file: 'queues-retryable-work-after-each-live-slot-cursor.json'
		},
		[
			{
				name: 'Two scoped code task slots skip completed work and retain failed and pending tasks',
				input: {
					root,
					state: activeState,
					tasks,
					results,
					processDiscovery: { executable: 'ps', output: processLines }
				},
				output
			}
		]
	);
}

test('Queues retryable work after each live slot cursor', () =>
	withTempDir('driver-worker-queue-examples-', runQueueExample));
