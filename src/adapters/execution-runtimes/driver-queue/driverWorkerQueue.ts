// @harness-uid u_6zzpeilqub
import { join, resolve } from 'node:path';
import type { DriverActive, DriverProcess } from '../DriverQueueAdapter.types';
import type {
	QueueJob,
	QueueSnapshot
} from '../../../services/execution-runtimes/QueueEtaService.types';
import { driverJson, driverProcesses, driverJobType } from './driverFiles';
/** Read pending task suffixes for each live slot, retaining failed tasks ahead of the cursor for retry. */
export function driverWorkerQueue(
	root: string,
	state: DriverActive,
	processes?: DriverProcess[]
): Pick<QueueSnapshot, 'queued' | 'slots'> {
	const queued: QueueJob[] = [],
		slots: Record<string, number> = {};
	const seen = new Set(state.active.map((j) => JSON.stringify([j.model, j.task])));
	for (const worker of processes ?? driverProcesses(root)) {
		slots[worker.model] = (slots[worker.model] ?? 0) + 1;
		const tasks = driverJson<{ id: string; type?: string }[]>(
			resolve(root, 'driver', worker.tasksFile),
			[]
		);
		const current = state.active.find(
			(j) => j.model === worker.model && String(j.slot) === worker.slot && j.kind !== 'reverify'
		);
		const cursor = tasks.findIndex((task) => task.id === current?.task);
		for (const task of tasks.slice(cursor + 1)) {
			const key = JSON.stringify([worker.model, task.id]);
			const done = driverJson<{ status?: string }>(
				join(root, `results-${worker.wave}`, worker.model, task.id, 'result.json'),
				{}
			);
			if (seen.has(key) || done.status === 'pass') continue;
			seen.add(key);
			queued.push({
				id: task.id,
				model: worker.model,
				type: task.type ?? driverJobType(task.id)
			});
		}
	}
	return { queued, slots };
}
