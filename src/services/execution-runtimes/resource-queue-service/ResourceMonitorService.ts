import { setTimeout as delay } from 'node:timers/promises';
import { mib } from '../../../core/execution-runtimes/resourceTypes';
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
		let lastSample: ResourceSnapshot | undefined;
		let lastJobs: ResourceJob[] = [];
		const check = () =>
			checkWaiting(options, began + timeout, () =>
				timeoutMessage(stated, lastSample, request, lastJobs)
			);
		while (true) {
			check();
			await this.sweep();
			this.options.queue.patch(id, { heartbeatAt: Date.now() });
			const sample = await this.snapshot(),
				config = resourceConfig(this.options.home);
			lastSample = sample;
			check();
			if (impossibleRequest(request, sample, config))
				throw new Error('Resource request exceeds usable capacity after reserves');
			lastJobs = this.options.queue.schedule(sample, config);
			const job = lastJobs.find((j) => j.id === id);
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

function checkWaiting(options: RunOptions, deadline: number, message: () => string): void {
	options.signal?.throwIfAborted();
	if (Date.now() > deadline) throw new Error(message());
}

function timeoutMessage(
	reason: string,
	sample: ResourceSnapshot | undefined,
	request: ResourceRequest,
	jobs: ResourceJob[]
): string {
	const parts = ['Resource queue wait timed out'];
	if (reason) parts.push(`last reason: ${reason}`);
	if (!sample) return parts.join('; ');
	const round = (value: number) => Math.round(value * 100) / 100;
	parts.push(
		`telemetry ${sample.status}, pressure ${sample.memoryPressure}`,
		`CPU available ${round(sample.cpuAvailableCores)}/${sample.usableCores} cores`,
		`memory available ${Math.floor(sample.memoryAvailableBytes / mib)}/${Math.floor(sample.memoryTotalBytes / mib)} MiB`,
		`request ${request.cpus} cores/${request.memoryMiB} MiB`
	);
	const ids = new Set(jobs.map((job) => job.id));
	const roots = jobs.filter(
		(job) => job.state === 'running' && (!job.parentId || !ids.has(job.parentId))
	);
	const cpu = roots.reduce((sum, job) => sum + job.cpus, 0);
	const memory = roots.reduce((sum, job) => sum + job.memoryMiB, 0);
	parts.push(`running reservations ${round(cpu)} cores/${round(memory)} MiB`);
	return parts.join('; ');
}
