// @harness-uid u_4rnjtzp6cn
import { trackerItemError } from '../../utils/projects-sessions/trackerItemError';
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchCandidate } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type {
	TrackerDispatcherService,
	TrackerDispatchResult,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';
import { liveOverdueSuffix } from '../agents-providers/tracker-dispatcher-service/runMonitor';
import { automaticEnabled } from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import {
	observeReservedRun,
	reconcileLegacyRuns,
	schedulerWaits
} from './trackerDispatchObservations';
import type { TrackerDispatchSchedulerOptions } from './TrackerDispatchSchedulerService.types';
import { TrackerDispatchQueue } from './trackerDispatchQueue';

const tickTimeout = 120_000;
const tickTimeoutMessage = 'dispatch tick timed out';

/** Reconcile committed attempts before reserving new work for the node. */
export class TrackerDispatchSchedulerService {
	private currentTick?: Promise<void>;
	private stopping = false;
	private readonly waits = new Map<string, { token: string; reason: string }>();
	private lastTickAt: string | null = null;
	private lastError: string | null = null;
	constructor(
		private readonly repository: TrackerDispatchRepository,
		private readonly dispatcher: TrackerDispatcherService,
		private readonly options: TrackerDispatchSchedulerOptions
	) {}

	status(minimumAge?: number) {
		return {
			enabled: this.options.policy ? automaticEnabled(this.options.policy) : true,
			stuck: this.repository.stuckRequests(minimumAge).map(({ flagged, ...item }) => ({
				...item,
				computer: item.computer ?? 'box',
				reason: flagged
					? 'waiting on Daniel (flagged)'
					: (this.waits.get(item.id)?.reason ?? 'ready but has not started')
			}))
		};
	}

	runnerStatus(limit = 100) {
		return {
			enabled: this.options.policy?.enabled !== false,
			last_tick_at: this.lastTickAt,
			automatic_enabled: this.options.policy ? automaticEnabled(this.options.policy) : true,
			capacity: this.lastTickAt ? (this.options.runner.capacity?.() ?? null) : null,
			last_error: this.lastError,
			...schedulerWaits(this.waits, limit)
		};
	}

	async stop(reference: string, signal: AbortSignal) {
		if (this.stopping) throw trackerItemError('another stop is in progress', 409);
		this.stopping = true;
		try {
			await this.currentTick?.catch(() => undefined);
			signal.throwIfAborted();
			const { item, run } = this.repository.launches.stopTarget(reference);
			if (run && (run.state !== 'finished' || run.outcome === 'blocked')) {
				const reserved = run.dispatch_at !== undefined || run.started_at !== null;
				if (reserved && !(await this.options.runner.stop?.(run, signal)))
					throw trackerItemError(
						`Run #${run.id} is opted out; Tracker could not confirm its session stopped`,
						409
					);
				this.repository.launches.finishStoppedRun(run);
			}
			return item;
		} finally {
			this.stopping = false;
		}
	}

	async tick(signal: AbortSignal): Promise<void> {
		if (signal.aborted || this.stopping || this.currentTick) return;
		const watchdog = dispatchWatchdog(signal, (lifetime) => this.poll(lifetime));
		this.currentTick = watchdog.poll;
		try {
			await this.currentTick;
		} catch (failure) {
			if (watchdog.timedOut()) this.lastError = tickTimeoutMessage;
			else if (!signal.aborted) this.lastError = 'dispatch tick failed';
			throw failure;
		} finally {
			this.currentTick = undefined;
		}
	}

	private async poll(signal: AbortSignal): Promise<void> {
		this.waits.clear();
		await this.options.runner.refresh?.(signal, this.repository.managedRuns());
		signal.throwIfAborted();
		await reconcileLegacyRuns(this.repository, this.options.runner, signal);
		signal.throwIfAborted();
		const queued = await this.reconcile(signal);
		await creditHumanRedos(this.repository, this.dispatcher, signal);
		signal.throwIfAborted();
		const queue = new TrackerDispatchQueue(
			this.repository,
			this.dispatcher,
			this.options,
			this.waits
		);
		const candidates = this.repository.candidates();
		await serveQueue(queue, { candidates, queued }, signal);
		signal.throwIfAborted();
		this.lastTickAt = new Date((this.options.policy?.now ?? Date.now)()).toISOString();
		this.lastError = null;
	}

	private async reconcile(signal: AbortSignal): Promise<TrackerRunReceipt[]> {
		const queued: TrackerRunReceipt[] = [];
		for (const run of this.repository.managedRuns()) {
			signal.throwIfAborted();
			if (run.state === 'queued' && run.dispatch_at === undefined) {
				queued.push(run);
				continue;
			}
			const event = await observeReservedRun(run, this.options, signal);
			signal.throwIfAborted();
			if (event) {
				const result = await this.dispatcher.record(run.item_id, run, event);
				signal.throwIfAborted();
				reportOverdue(run, result, this.options);
			} else if (run.state === 'queued' && !this.waits.has(run.item_id))
				this.waits.set(run.item_id, {
					token: run.auto_token,
					reason: 'waiting for host startup evidence'
				});
		}
		return queued;
	}
}

async function creditHumanRedos(
	repository: TrackerDispatchRepository,
	dispatcher: TrackerDispatcherService,
	signal: AbortSignal
) {
	for (const [itemId, runIds] of repository.humanRedoCandidates()) {
		signal.throwIfAborted();
		await dispatcher.creditHumanRedo(itemId, runIds);
	}
}

function dispatchWatchdog(signal: AbortSignal, poll: (signal: AbortSignal) => Promise<void>) {
	const deadline = new AbortController();
	const lifetime = AbortSignal.any([signal, deadline.signal]);
	const timer = setTimeout(() => deadline.abort(new Error(tickTimeoutMessage)), tickTimeout);
	let cancel!: () => void;
	const aborted = new Promise<never>((_, reject) => {
		cancel = () => reject(lifetime.reason);
		lifetime.addEventListener('abort', cancel, { once: true });
	});
	const completed = Promise.race([poll(lifetime), aborted]).finally(() => {
		clearTimeout(timer);
		lifetime.removeEventListener('abort', cancel);
	});
	return { poll: completed, timedOut: () => deadline.signal.aborted };
}

function reportOverdue(
	run: TrackerRunReceipt,
	result: TrackerDispatchResult,
	{ runner }: TrackerDispatchSchedulerOptions
) {
	if (result.status === 'held' && result.reason.endsWith(liveOverdueSuffix))
		runner.overdue?.(run, result.reason);
}

async function serveQueue(
	queue: TrackerDispatchQueue,
	{ candidates, queued }: { candidates: TrackerDispatchCandidate[]; queued: TrackerRunReceipt[] },
	signal: AbortSignal
) {
	const claim = (candidate: TrackerDispatchCandidate) => queue.claim(candidate, signal);
	const urgent = (candidate: TrackerDispatchCandidate) => candidate.priority === 'urgent';
	if (await requestNextCandidate(candidates.filter(explicitCandidate), claim)) return;
	const automatic = candidates.filter((candidate) => !explicitCandidate(candidate));
	if (await requestNextCandidate(automatic.filter(urgent), claim)) return;
	if (await requestNextCandidate(queued, (run) => queue.retry(run, signal))) return;
	await requestNextCandidate(
		automatic.filter((candidate) => !urgent(candidate)),
		claim
	);
}

function explicitCandidate(candidate: TrackerDispatchCandidate) {
	return Boolean(
		candidate.auto && (!candidate.launch_source || candidate.launch_source === 'manual')
	);
}

async function requestNextCandidate<Candidate>(
	candidates: readonly Candidate[],
	claim: (candidate: Candidate) => Promise<boolean>
) {
	for (const candidate of candidates) {
		if (await claim(candidate)) return true;
	}
	return false;
}
