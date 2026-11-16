import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DriverQueueAdapter } from '../../../src/adapters/execution-runtimes/DriverQueueAdapter';
import { withTempDir } from '../../support/temporary';

test('read and render retain active_jobs counts while pruning dead PIDs without writes', async () => {
	await withTempDir('harness-driver-', (root) => {
		const status = {
			active: [
				{
					model: 'luna',
					task: 'a',
					unit: 'u',
					kind: 'job',
					slot: 1,
					pid: process.pid,
					started_ts: 100
				},
				{
					model: 'haiku',
					task: 'b',
					kind: 'reverify',
					slot: 'r1',
					pid: process.pid,
					started_ts: 100
				},
				{ model: 'haiku', task: 'dead', kind: 'job', pid: 2147483647 }
			],
			totals: { planned: 2, done: 1, pass: 1, fail: 0 },
			reverify_totals: { planned: 1, done: 0, pass: 0, fail: 0 }
		};
		writeFileSync(join(root, 'active-jobs.json'), JSON.stringify(status));
		const adapter = new DriverQueueAdapter({ statusDir: root, root, processes: [] });
		const result = adapter.active();
		expect(result.counts).toEqual({ luna: 1, haiku: 0, total: 1, reverify: 1 });
		expect(result.totals.remaining).toBe(1);
		expect(adapter.render(result)).toContain('Luna 1 · Haiku 0 · total 1');
		expect(JSON.parse(readFileSync(join(root, 'active-jobs.json'), 'utf8')).active).toHaveLength(3);
		mkdirSync(join(root, 'results-wave', 'luna', 'done'), { recursive: true });
		writeFileSync(join(root, 'results-wave', 'luna', 'done', 'result.json'), '{"status":"pass"}');
		writeFileSync(
			join(root, 'tasks.json'),
			JSON.stringify([{ id: 'a' }, { id: 'done' }, { id: 'pending' }])
		);
		const reader = new DriverQueueAdapter({
			statusDir: root,
			root,
			processes: [{ model: 'luna', slot: '1', wave: 'wave', tasksFile: join(root, 'tasks.json') }]
		});
		expect(reader.read().queued).toEqual([{ id: 'pending', model: 'luna', type: 'code' }]);
		expect(reader.read().slots).toEqual({ luna: 1, reverify: 1 });
	});
});
