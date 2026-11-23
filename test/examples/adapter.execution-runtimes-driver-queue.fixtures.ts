import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DriverQueueAdapter } from '../../src/adapters/execution-runtimes/DriverQueueAdapter';

export function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(value));
}

function writeResult(root: string, resultPath: string, status: string): void {
	writeJson(join(root, resultPath, 'result.json'), { status });
}

export function readAdapter(root: string): DriverQueueAdapter {
	const statusDir = join(root, 'status');
	const driverDir = join(root, 'driver');
	writeReadStatus(statusDir);
	writeJson(join(driverDir, 'luna-tasks.json'), [
		{ id: 'before-cursor' },
		{ id: 'code-phase-current' },
		{ id: 'p1-contract-next' },
		{ id: 'passed-luna' },
		{ id: 'code-phase-retry' }
	]);
	writeJson(join(driverDir, 'haiku-tasks.json'), [
		{ id: 'p2a-stub-current' },
		{ id: 'w3-component-next' },
		{ id: 'passed-haiku' },
		{ id: 'video-pending' }
	]);
	writeResult(root, join('results-wave-a', 'luna', 'passed-luna'), 'pass');
	writeResult(root, join('results-wave-a', 'luna', 'code-phase-retry'), 'fail');
	writeResult(root, join('results-wave-a', 'haiku', 'passed-haiku'), 'pass');
	writeJson(join(root, 'results-code-phase-reverify', 'review-done', 'result.json'), {
		status: 'pass'
	});
	return new DriverQueueAdapter({
		root,
		statusDir,
		processes: [
			{ model: 'luna', slot: '1', wave: 'wave-a', tasksFile: 'luna-tasks.json' },
			{ model: 'haiku', slot: '2', wave: 'wave-a', tasksFile: 'haiku-tasks.json' }
		]
	});
}

function writeReadStatus(statusDir: string): void {
	writeJson(join(statusDir, 'active-jobs.json'), {
		active: [
			{
				model: 'luna',
				task: 'code-phase-current',
				kind: 'job',
				slot: 1,
				pid: process.pid,
				started_ts: 100
			},
			{
				model: 'haiku',
				task: 'p2a-stub-current',
				kind: 'job',
				slot: 2,
				pid: process.pid,
				started_ts: 200
			},
			{
				model: 'haiku',
				task: 'review-active',
				kind: 'reverify',
				slot: 'r1',
				pid: process.pid,
				started_ts: 300
			}
		],
		totals: { planned: 4, done: 1, pass: 1, fail: 0, remaining: 3 },
		reverify_totals: { planned: 2, done: 0, pass: 0, fail: 0, remaining: 2 },
		counts: { luna: 0, haiku: 0, total: 0, reverify: 0 },
		updated: '2026-11-16 10:30'
	});
	writeJson(join(statusDir, 'run-plan.json'), {
		reverify: {
			'review-active': ['haiku'],
			'review-done': ['luna'],
			'review-next': ['haiku', 'luna']
		}
	});
}
