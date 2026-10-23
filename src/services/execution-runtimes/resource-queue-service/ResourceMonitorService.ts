import { setTimeout as delay } from 'node:timers/promises';
import type {
	ResourceJob,
	ResourceRequest,
	ResourceSnapshot
} from '../../../core/execution-runtimes/resourceTypes';
import { processTable } from '../../../utils/development-tooling/processDescendants';
import { resourceConfig } from '../../../utils/execution-runtimes/resourceConfig';
import { abandonedResources } from '../../../utils/execution-runtimes/resourceIdentity';
import type { RunOptions } from '../ResourceQueueService';
import { HostResourcesAdapter } from './resource-monitor-service/host-resources-adapter/HostResourcesAdapter';
import { impossibleRequest, resourcePressure } from './resource-policy/resourcePolicy';
import type { MonitorOptions } from './ResourceMonitorService.types';
export type { MonitorOptions } from './ResourceMonitorService.types';
export class ResourceMonitorService {
	private readonly adapter: { sample(): Promise<ResourceSnapshot> };
	private lastSweep = 0;
	constructor(private readonly options: MonitorOptions) {
		this.adapter = options.adapter ?? new HostResourcesAdapter();
	}
	async snapshot(): Promise<ResourceSnapshot> {
		const previous = this.options.queue.snapshot();
		const age = previous ? Date.now() - previous.sampledAt : Infinity;
		if (previous && age >= 0 && age < resourceConfig(this.options.home).pollMs) return previous;
		const sample = await this.adapter.sample();
		this.options.queue.saveSnapshot(sample);
		return sample;
	}
	async heartbeat(id: string): Promise<void> {
		let notice: string | null = 'Resource monitoring failed; subsequent work is held';
		try {
			notice = resourcePressure(await this.snapshot(), resourceConfig(this.options.home));
		} catch {
			/* Keep the running task alive; new admissions fail closed. */
		}
		this.options.queue.patch(id, { heartbeatAt: Date.now(), notice });
	}
	async sweep(): Promise<void> {
		if (Date.now() - this.lastSweep < 5000) return;
		this.lastSweep = Date.now();
		const jobs = this.options.queue.all();
		if (!jobs.some((j) => Date.now() - j.heartbeatAt > 30000)) return;
		const rows = await processTable();
		if (rows) for (const id of abandonedResources(jobs, rows)) this.options.queue.remove(id);
	}
	private checkParent(job: ResourceJob): void {
		if (
			job.parentId &&
			!this.options.queue
				.all()
				.some((parent) => parent.id === job.parentId && parent.state === 'running')
		)
			throw new Error('Parent resource reservation ended');
	}

	async wait(id: string, request: ResourceRequest, options: RunOptions): Promise<void> {
		const began = Date.now(),
			timeout = options.waitTimeoutMs ?? 1800000;
		let stated = '';
		while (true) {
			checkWaiting(options, began + timeout);
			await this.sweep();
			this.options.queue.patch(id, { heartbeatAt: Date.now() });
			const sample = await this.snapshot(),
				config = resourceConfig(this.options.home);
			checkWaiting(options, began + timeout);
			if (impossibleRequest(request, sample, config))
				throw new Error('Resource request exceeds usable capacity after reserves');
			const job = this.options.queue.schedule(sample, config).find((j) => j.id === id);
			if (!job) throw new Error('Resource request disappeared');
			this.checkParent(job);
			if (job.state === 'running') return;
			if (job.notice && job.notice !== stated) {
				stated = job.notice;
				options.onWaiting?.(stated);
			}
			await delay(config.pollMs, undefined, { signal: options.signal });
		}
	}
}

function checkWaiting(options: RunOptions, deadline: number): void {
	options.signal?.throwIfAborted();
	if (Date.now() > deadline) throw new Error('Resource queue wait timed out');
}
