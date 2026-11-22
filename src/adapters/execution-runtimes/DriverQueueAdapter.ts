// @harness-uid u_ew2a54dglc
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
	DriverActive,
	DriverQueueAdapterConfig,
	DriverTotals
} from './DriverQueueAdapter.types';
import type {
	QueueJob,
	QueueSnapshot
} from '../../services/execution-runtimes/QueueEtaService.types';
import { driverJson, driverJobType, livePid } from './driver-queue/driverFiles';
import { driverWorkerQueue } from './driver-queue/driverWorkerQueue';
import { renderDriverActive } from './driver-queue/renderDriverActive';
/** Read-only adapter for atomic status, live slot task files and completed results. */
export class DriverQueueAdapter {
	readonly root: string;
	readonly statusDir: string;
	constructor(private readonly config: DriverQueueAdapterConfig = {}) {
		this.root =
			config.root ??
			join(homedir(), 'projects/harness-shots/component-pyramid/luna-pyramid-20261110');
		this.statusDir =
			config.statusDir ?? join(homedir(), 'projects/harness-shots/code-phase-20261116');
	}
	active(): DriverActive {
		const zero = { planned: 0, done: 0, pass: 0, fail: 0, remaining: 0 };
		const state = driverJson<DriverActive>(join(this.statusDir, 'active-jobs.json'), {
			active: [],
			totals: zero,
			reverify_totals: zero,
			counts: { luna: 0, haiku: 0, total: 0, reverify: 0 },
			updated: ''
		});
		const active = state.active.filter((job) => livePid(job.pid));
		const workers = active.filter((job) => (job.kind ?? 'job') === 'job');
		return {
			...state,
			active,
			totals: this.totals(state.totals),
			reverify_totals: this.totals(state.reverify_totals),
			counts: {
				luna: workers.filter((j) => j.model === 'luna').length,
				haiku: workers.filter((j) => j.model === 'haiku').length,
				total: workers.length,
				reverify: active.filter((j) => j.kind === 'reverify').length
			}
		};
	}
	read(): QueueSnapshot {
		const state = this.active();
		const running: QueueJob[] = state.active.map((j) => ({
			id: j.task,
			model: j.model,
			type: j.kind === 'reverify' ? 'reverify' : driverJobType(j.task),
			startedAt: j.started_ts === undefined ? undefined : j.started_ts * 1000
		}));
		const { queued, slots } = driverWorkerQueue(this.root, state, this.config.processes);
		const seen = new Set(running.map((j) => JSON.stringify([j.model, j.id])));
		if (state.counts.reverify) slots.reverify = state.counts.reverify;
		this.reverifyQueue(state, queued, seen);
		return {
			queued,
			running,
			slots,
			warnings: state.updated
				? [
						`Driver status snapshot: ${state.updated} Europe/Lisbon; capacity inferred from live slot processes`
					]
				: ['No live driver status file found']
		};
	}
	render(state: DriverActive = this.active()): string {
		return renderDriverActive(state);
	}
	private totals(totals: DriverTotals): DriverTotals {
		return { ...totals, remaining: Math.max(0, totals.planned - totals.done) };
	}
	private reverifyQueue(state: DriverActive, queued: QueueJob[], seen: Set<string>): void {
		const plan = driverJson<{ reverify?: Record<string, string[]> }>(
			join(this.statusDir, 'run-plan.json'),
			{}
		);
		for (const [id, models] of Object.entries(plan.reverify ?? {})) {
			if (
				state.active.some((j) => j.task === id && j.kind === 'reverify') ||
				existsSync(join(this.root, 'results-code-phase-reverify', id, 'result.json'))
			)
				continue;
			const model = models[0] ?? 'unknown',
				key = JSON.stringify([model, id]);
			if (!seen.has(key)) queued.push({ id, model, type: 'reverify' });
		}
	}
}
