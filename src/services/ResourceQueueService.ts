import { resolve } from 'node:path';
import { setInterval, clearInterval } from 'node:timers';
import { resourceContext } from '../utils/resourceContext';
import { ResourceMonitorService } from './ResourceMonitorService';
import { randomUUID } from 'node:crypto';
import { ProcessIdentityAdapter } from '../adapters/ProcessIdentityAdapter';
import { ResourceQueueRepository } from '../repositories/ResourceQueueRepository';
import { resourceConfig, resourceHome } from '../utils/resourceConfig';
import { resourceIdentity } from '../utils/resourceIdentity';
import {
	resourceRequestSchema,
	type ResourceContext,
	type ResourceRequest,
	type ResourceSnapshot
} from '../core/resourceTypes';
export interface RunOptions {
	signal?: AbortSignal;
	env?: Record<string, string | undefined>;
	waitTimeoutMs?: number;
	onWaiting?: (reason: string) => void;
}
interface Dependencies {
	home?: string;
	env?: Record<string, string | undefined>;
	monitor?: { sample(): Promise<ResourceSnapshot> };
}
export class ResourceQueueService {
	readonly home: string;
	readonly queue: ResourceQueueRepository;
	private readonly monitor: ResourceMonitorService;
	private readonly env: Record<string, string | undefined>;
	constructor(options: Dependencies = {}) {
		this.env = options.env ?? process.env;
		this.home = resolve(options.home ?? resourceHome(this.env));
		this.queue = new ResourceQueueRepository(this.home);
		this.monitor = new ResourceMonitorService({
			home: this.home,
			queue: this.queue,
			adapter: options.monitor
		});
	}
	snapshot(): Promise<ResourceSnapshot> {
		return this.monitor.snapshot();
	}

	async run<T>(
		input: ResourceRequest,
		action: (context: ResourceContext) => Promise<T>,
		options: RunOptions = {}
	): Promise<T> {
		const request = resourceRequestSchema.parse(input),
			env = options.env ?? this.env;
		options.signal?.throwIfAborted();
		if (
			options.waitTimeoutMs !== undefined &&
			(!Number.isFinite(options.waitTimeoutMs) || options.waitTimeoutMs <= 0)
		)
			throw new Error('Invalid resource queue wait timeout');
		const id = await this.enqueue(request, env);
		try {
			await this.monitor.wait(id, request, options);
			options.signal?.throwIfAborted();
			return await this.execute(
				resourceContext(id, request, { ...env, HARNESS_RESOURCES_HOME: this.home }, this.queue),
				action
			);
		} finally {
			this.queue.remove(id);
		}
	}
	private async enqueue(
		request: ResourceRequest,
		env: Record<string, string | undefined>
	): Promise<string> {
		const inherited = env.HARNESS_RESOURCE_LEASE;
		if (inherited) await this.parent(inherited, request);
		const owner = new ProcessIdentityAdapter().find(process.pid);
		if (!owner.startedAt) throw new Error('Cannot establish resource request owner');
		if (this.queue.all().length >= 512) throw new Error('Resource queue is full');
		const id = randomUUID(),
			now = Date.now();
		this.queue.add({
			...request,
			parentId: inherited === '' ? undefined : inherited,
			id,
			ownerPid: process.pid,
			ownerStarted: owner.startedAt,
			state: 'queued',
			createdAt: now,
			heartbeatAt: now,
			notice: null
		});
		return id;
	}
	private async execute<T>(
		context: ResourceContext,
		action: (context: ResourceContext) => Promise<T>
	): Promise<T> {
		let pending: Promise<void> | undefined;
		const timer = setInterval(() => {
			pending ??= this.monitor
				.heartbeat(context.id)
				.catch(() => undefined)
				.finally(() => {
					pending = undefined;
				});
		}, resourceConfig(this.home).pollMs);
		try {
			return await action(context);
		} finally {
			clearInterval(timer);
			await pending;
		}
	}

	close(): void {
		this.queue.close();
	}

	private async parent(id: string, request: ResourceRequest): Promise<void> {
		const parent = this.queue.all().find((job) => job.id === id && job.state === 'running');
		if (!parent || !(await resourceIdentity(parent)))
			throw new Error('Invalid inherited resource lease');
		if (request.cpus > parent.cpus || request.memoryMiB > parent.memoryMiB)
			throw new Error('Nested work exceeds its parent resource reservation');
	}
}
