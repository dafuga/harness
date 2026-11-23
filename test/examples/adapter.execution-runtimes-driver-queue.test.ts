import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { DriverQueueAdapter } from '../../src/adapters/execution-runtimes/DriverQueueAdapter';
import type { DriverActive } from '../../src/adapters/execution-runtimes/DriverQueueAdapter.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'adapter.execution-runtimes-driver-queue';
const evidence = 'examples-cases';

function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(value));
}

function writeResult(root: string, resultPath: string, status: string): void {
	writeJson(join(root, resultPath, 'result.json'), { status });
}

function readAdapter(root: string): DriverQueueAdapter {
	const statusDir = join(root, 'status');
	const driverDir = join(root, 'driver');
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

test('active prunes dead workers and recalculates totals', async () => {
	await withTempDir('driver-queue-active-', (root) => {
		const statusDir = join(root, 'status');
		const snapshotPath = join(statusDir, 'active-jobs.json');
		const source = {
			active: [
				{ model: 'luna', task: 'code-phase-live', kind: 'job', slot: 1, pid: process.pid },
				{ model: 'haiku', task: 'stale-worker', kind: 'job', slot: 2, pid: 2147483647 },
				{ model: 'haiku', task: 'review-live', kind: 'reverify', slot: 'r1', pid: process.pid }
			],
			totals: { planned: 8, done: 3, pass: 2, fail: 1, remaining: 99 },
			reverify_totals: { planned: 4, done: 1, pass: 1, fail: 0, remaining: 99 },
			counts: { luna: 0, haiku: 2, total: 2, reverify: 0 },
			updated: '2026-11-16 10:30'
		};
		writeJson(snapshotPath, source);
		const before = readFileSync(snapshotPath, 'utf8');
		const adapter = new DriverQueueAdapter({ root, statusDir, processes: [] });
		const active = adapter.active();

		expect(active.active.map((job) => job.task)).toEqual(['code-phase-live', 'review-live']);
		expect(active.counts).toEqual({ luna: 1, haiku: 0, total: 1, reverify: 1 });
		expect(active.totals).toEqual({ planned: 8, done: 3, pass: 2, fail: 1, remaining: 5 });
		expect(active.reverify_totals.remaining).toBe(3);
		expect(readFileSync(snapshotPath, 'utf8')).toBe(before);
		recordExampleCases(
			{
				unitId,
				symbol: 'DriverQueueAdapter.active',
				state: 'active-prunes-dead-workers-and-recalculates-totals',
				evidence,
				file: 'active-prunes-dead-workers-and-recalculates-totals.json'
			},
			[
				{
					name: 'live and stale jobs recalculate counts while preserving the status file',
					input: {
						activeJobs: [
							{ task: 'code-phase-live', model: 'luna', pid: 'live' },
							{ task: 'stale-worker', model: 'haiku', pid: 'dead' },
							{ task: 'review-live', model: 'haiku', kind: 'reverify', pid: 'live' }
						],
						totals: { planned: 8, done: 3 },
						reverifyTotals: { planned: 4, done: 1 }
					},
					output: {
						activeTasks: active.active.map((job) => job.task),
						counts: active.counts,
						remaining: [active.totals.remaining, active.reverify_totals.remaining],
						sourceUnchanged: readFileSync(snapshotPath, 'utf8') === before
					}
				}
			]
		);
	});
});

test('read assembles pending work, running jobs, and live capacity', async () => {
	await withTempDir('driver-queue-read-', (root) => {
		const queue = readAdapter(root).read();

		expect(queue.queued).toEqual([
			{ id: 'p1-contract-next', model: 'luna', type: 'contract' },
			{ id: 'code-phase-retry', model: 'luna', type: 'smell' },
			{ id: 'w3-component-next', model: 'haiku', type: 'component' },
			{ id: 'video-pending', model: 'haiku', type: 'video' },
			{ id: 'review-next', model: 'haiku', type: 'reverify' }
		]);
		expect(queue.running.map((job) => [job.id, job.startedAt])).toEqual([
			['code-phase-current', 100000],
			['p2a-stub-current', 200000],
			['review-active', 300000]
		]);
		expect(queue.slots).toEqual({ luna: 1, haiku: 1, reverify: 1 });
		recordExampleCases(
			{
				unitId,
				symbol: 'DriverQueueAdapter.read',
				state: 'read-assembles-pending-work-running-jobs-and-live-capacity',
				evidence,
				file: 'read-assembles-pending-work-running-jobs-and-live-capacity.json'
			},
			[
				{
					name: 'two model slots retain retry work and an unfinished reverify plan',
					input: {
						activeTasks: ['code-phase-current', 'p2a-stub-current', 'review-active'],
						taskFiles: {
							luna: ['p1-contract-next', 'passed-luna', 'code-phase-retry'],
							haiku: ['w3-component-next', 'passed-haiku', 'video-pending']
						},
						completed: ['passed-luna', 'passed-haiku', 'review-done'],
						reverifyPlan: ['review-active', 'review-done', 'review-next']
					},
					output: {
						queued: queue.queued,
						running: queue.running.map(({ id, model, type }) => ({ id, model, type })),
						slots: queue.slots,
						warnings: queue.warnings
					}
				}
			]
		);
	});
});

test('render formats a supplied active snapshot without writing', async () => {
	await withTempDir('driver-queue-render-', (root) => {
		const statusDir = join(root, 'status');
		mkdirSync(statusDir);
		const state: DriverActive = {
			active: [
				{
					model: 'luna',
					kind: 'job',
					unit: 'adapter.alpha',
					task: 'code-task',
					slot: 1,
					pid: 31,
					started: '10:00'
				},
				{
					model: 'haiku',
					kind: 'reverify',
					unit: 'adapter.beta',
					task: 'review-task',
					slot: 'r1',
					pid: 32,
					started: '10:01'
				}
			],
			totals: { planned: 3, done: 2, pass: 2, fail: 0, remaining: 1 },
			reverify_totals: { planned: 2, done: 1, pass: 1, fail: 0, remaining: 1 },
			counts: { luna: 1, haiku: 1, total: 2, reverify: 1 },
			updated: '2026-11-16 10:30'
		};
		const adapter = new DriverQueueAdapter({ root, statusDir, processes: [] });
		const rendered = adapter.render(state);
		const expected =
			'# Active jobs (2026-11-16 10:30 Lisbon)\n\n' +
			'**Luna 1 · Haiku 1 · total 2** (+ 1 re-verify gate runs). Done 2 (pass 2, fail 0), remaining 1 of 3 planned.\n' +
			'Re-verify: done 1 (pass 1, fail 0), remaining 1 of 2.\n\n' +
			'| Model | Kind | Unit | Task | Slot | PID | Started |\n' +
			'|---|---|---|---|---|---:|---|\n' +
			'| haiku | reverify | adapter.beta | review-task | r1 | 32 | 10:01 |\n' +
			'| luna | job | adapter.alpha | code-task | 1 | 31 | 10:00 |\n';
		expect(rendered).toBe(expected);
		expect(existsSync(join(statusDir, 'ACTIVE.md'))).toBe(false);
		recordExampleCases(
			{
				unitId,
				symbol: 'DriverQueueAdapter.render',
				state: 'render-formats-a-supplied-active-snapshot-without-writing',
				evidence,
				file: 'render-formats-a-supplied-active-snapshot-without-writing.json'
			},
			[
				{
					name: 'active jobs and totals format as the existing markdown status table',
					input: { state },
					output: rendered
				}
			]
		);
	});
});
