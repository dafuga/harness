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
			stuck: stuckWithReasons(this.repository.stuckRequests(), this.waits)
		};
	}

	runnerStatus() {
		return {
			enabled: this.options.policy?.enabled !== false,
			last_tick_at: this.lastTickAt,
			last_error: this.lastError,
			waiting_on: this.waits.values().next().value ?? null,
			queued: this.waits.size
		};
	}

	async tick(signal: AbortSignal): Promise<void> {
		if (signal.aborted || this.ticking) return;
		this.ticking = true;
		this.waits.clear();
		try {
			await this.options.runner.refresh?.(signal, this.repository.managedRuns());
			signal.throwIfAborted();
			adoptLegacyRuns(this.repository, this.options.runner);
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
				if (await this.prepare(run, signal)) return true;
				continue;
			}
			const event =
				(await this.options.runner.observe(run, attemptKey(run), signal)) ??
				(await expiredStartEvent(run, this.options, signal));
			if (event) await this.dispatcher.record(run.item_id, run, event);
		}
		return false;
	}

	private async prepare(run: TrackerRunReceipt, signal: AbortSignal): Promise<boolean> {
		const grant =
			run.launch_source === 'due'
				? await this.options.grant?.(run.item_id, run.auto_token, signal)
				: undefined;
		signal.throwIfAborted();
		return this.release(await this.dispatcher.prepare(run.item_id, run, grant), signal);
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
		const decision = await this.dispatcher.claim(id, intent.token, permission);
		if (decision.status === 'held' && !this.waits.has(id)) this.waits.set(id, decision.reason);
		return this.release(decision, signal);
	}

	private async release(result: TrackerDispatchResult, signal: AbortSignal): Promise<boolean> {
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

function adoptLegacyRuns(
	repository: TrackerDispatchRepository,
	runner: TrackerDispatchRunner
): void {
	if (!runner.legacySession) return;
	for (const run of repository.legacyRuns()) {
		const session = runner.legacySession(run);
		if (session) repository.adoptLegacy(run, session);
	}
}

function stuckWithReasons(
	stuck: ReturnType<TrackerDispatchRepository['stuckRequests']>,
	waits: ReadonlyMap<string, string>
) {
	return stuck.map(({ flagged, ...item }) => ({
		...item,
		computer: item.computer ?? 'box',
		reason: flagged
			? 'waiting on Daniel (flagged)'
			: (waits.get(item.id) ?? 'ready but has not started')
	}));
}
