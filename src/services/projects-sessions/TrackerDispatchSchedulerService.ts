// @harness-uid u_4rnjtzp6cn
import { randomUUID } from 'node:crypto';
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchCandidate } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type {
	TrackerDispatcherService,
	TrackerDispatchResult,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';
import {
	attemptKey,
	ownsLaunch
} from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import { launchStartupGrace } from '../agents-providers/tracker-dispatcher-service/runClaim';
import type {
	TrackerDispatchRunner,
	TrackerDispatchSchedulerOptions,
	TrackerReservedStart
} from './TrackerDispatchSchedulerService.types';

/** Reconcile committed attempts before reserving new work for the node. */
export class TrackerDispatchSchedulerService {
	private ticking = false;
	private readonly waits = new Map<string, string>();
	private lastTickAt: string | null = null;
	private lastError: string | null = null;
	constructor(
		private readonly repository: TrackerDispatchRepository,
		private readonly dispatcher: TrackerDispatcherService,
		private readonly options: TrackerDispatchSchedulerOptions
	) {}

	status() {
		return {
			enabled: this.options.policy?.enabled !== false,
			stuck: this.repository.stuckRequests().map(({ flagged, ...item }) => ({
				...item,
				computer: item.computer ?? 'box',
				reason: flagged
					? 'waiting on Daniel (flagged)'
					: (this.waits.get(item.id) ?? 'ready but has not started')
			}))
		};
	}

	runnerStatus() {
		return {
			enabled: this.options.policy?.enabled !== false,
			last_tick_at: this.lastTickAt,
			last_error: this.lastError,
			waiting_on: this.waits.values().next().value ?? null,
			waiting: Object.fromEntries([...this.waits].slice(0, 100))
		};
	}

	async tick(signal: AbortSignal): Promise<void> {
		if (signal.aborted || this.ticking) return;
		this.ticking = true;
		this.waits.clear();
		try {
			await this.options.runner.refresh?.(signal, this.repository.managedRuns());
			signal.throwIfAborted();
			await reconcileLegacyRuns(this.repository, this.options.runner, signal);
			if (!(await this.reconcile(signal))) await this.requestWork(signal);
			if (signal.aborted) return;
			this.lastTickAt = new Date((this.options.policy?.now ?? Date.now)()).toISOString();
			this.lastError = null;
		} catch (error) {
			if (!signal.aborted) this.lastError = 'dispatch tick failed';
			throw error;
		} finally {
			this.ticking = false;
		}
	}

	private async reconcile(signal: AbortSignal): Promise<boolean> {
		for (const run of this.repository.managedRuns()) {
			signal.throwIfAborted();
			if (run.state === 'queued' && run.dispatch_at === undefined) {
				const decision = await prepareQueuedRun(run, this.dispatcher, this.options, signal);
				if (await this.release(run.item_id, decision, signal)) return true;
				continue;
			}
			const event = await observeReservedRun(run, this.options, signal);
			if (event) await this.dispatcher.record(run.item_id, run, event);
			else if (run.state === 'queued' && !this.waits.has(run.item_id))
				this.waits.set(run.item_id, 'waiting for host startup evidence');
		}
		return false;
	}

	private async requestWork(signal: AbortSignal): Promise<void> {
		for (const candidate of this.repository.candidates()) {
			signal.throwIfAborted();
			if (await this.claim(candidate, signal)) return;
		}
	}

	private async claim(candidate: TrackerDispatchCandidate, signal: AbortSignal): Promise<boolean> {
		const { id, auto, launch_source, launch_target } = candidate;
		const source = launch_source === 'due' ? 'due' : 'manual';
		if (auto) return this.claimIntent(id, { token: auto, source, target: launch_target }, signal);
		if (!this.options.scheduleDue) return false;
		const request = await this.dispatcher.request(id, { source: 'due', token: randomUUID() });
		return request.status === 'requested' && this.claimIntent(id, request.intent, signal);
	}

	private async claimIntent(
		id: string,
		intent: { token: string; source: 'manual' | 'due'; target: string | null },
		signal: AbortSignal
	): Promise<boolean> {
		const { policy, grant } = this.options;
		if (policy && !ownsLaunch(intent, policy)) return false;
		const permission =
			intent.source === 'due' ? await grant?.(id, intent.token, signal) : undefined;
		signal.throwIfAborted();
		return this.release(id, await this.dispatcher.claim(id, intent.token, permission), signal);
	}

	private async release(id: string, result: TrackerDispatchResult, signal: AbortSignal) {
		if (result.status === 'held' && !this.waits.has(id)) this.waits.set(id, result.reason);
		if (result.status !== 'start') return false;
		const { run } = result;
		const event = await startReservedRun(this.options.runner, result, signal);
		if (!event) {
			this.waits.set(run.item_id, 'waiting for host startup evidence');
			return false;
		}
		const observed = await this.dispatcher.record(run.item_id, run, event);
		return event.type === 'session' && observed.status === 'recorded';
	}
}

async function prepareQueuedRun(
	run: TrackerRunReceipt,
	dispatcher: TrackerDispatcherService,
	{ grant }: TrackerDispatchSchedulerOptions,
	signal: AbortSignal
) {
	const permission =
		run.launch_source === 'due' ? await grant?.(run.item_id, run.auto_token, signal) : undefined;
	signal.throwIfAborted();
	return dispatcher.prepare(run.item_id, run, permission);
}

async function startReservedRun(
	runner: TrackerDispatchRunner,
	reservation: TrackerReservedStart,
	signal: AbortSignal
) {
	signal.throwIfAborted();
	try {
		return await runner.start(
			reservation,
			signal,
			launchCompletionInstructions(reservation.run.item_id)
		);
	} catch {
		// The host might have started the session before losing its reply.
		return undefined;
	} finally {
		signal.throwIfAborted();
	}
}

async function observeReservedRun(
	run: TrackerRunReceipt,
	options: TrackerDispatchSchedulerOptions,
	signal: AbortSignal
) {
	return (
		(await options.runner.observe(run, attemptKey(run), signal)) ??
		(await expiredStartEvent(run, options, signal))
	);
}

async function expiredStartEvent(
	run: TrackerRunReceipt,
	{ runner, policy }: TrackerDispatchSchedulerOptions,
	signal: AbortSignal
) {
	if (run.state !== 'queued' || run.dispatch_at === undefined) return undefined;
	const now = policy ? policy.now() : Date.now();
	if (now - run.dispatch_at < launchStartupGrace) return undefined;
	const confirmed = await runner.confirmNeverStarted?.(run, signal);
	signal.throwIfAborted();
	return confirmed ? ({ type: 'never-started' } as const) : undefined;
}

function launchCompletionInstructions(itemId: string): string {
	return [
		'## Completion and worktree cleanup',
		'',
		`After verification passes, run \`tracker done ${itemId.slice(0, 6)} --note "<result, PR link, tests run>"\` first and verify it succeeds.`,
		'Remove a task-owned worktree only as the final step, after leaving it and only when authorized.',
		'Never remove your current working directory. Leave cleanup to the launcher or a separate session if you are still in the worktree.'
	].join('\n');
}

async function reconcileLegacyRuns(
	repository: TrackerDispatchRepository,
	runner: TrackerDispatchRunner,
	signal: AbortSignal
): Promise<void> {
	if (!runner.legacySession && !runner.confirmLegacyNeverStarted) return;
	for (const run of repository.legacyRuns()) {
		signal.throwIfAborted();
		if (run.state === 'queued') {
			const absent = await runner.confirmLegacyNeverStarted?.(run, signal).catch(() => false);
			signal.throwIfAborted();
			if (absent) repository.retireLegacy(run);
			continue;
		}
		const session = runner.legacySession?.(run);
		if (session) repository.adoptLegacy(run, session);
	}
}
