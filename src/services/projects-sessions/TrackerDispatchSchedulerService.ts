// @harness-uid u_4rnjtzp6cn
import { randomUUID } from 'node:crypto';
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchCandidate } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type {
	TrackerDispatcherService,
	TrackerLaunchIntent,
	TrackerDispatchResult,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';
import { ownsLaunch } from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import {
	observeReservedRun,
	reconcileLegacyRuns,
	schedulerWaits
} from './trackerDispatchObservations';
import type {
	TrackerDispatchRunner,
	TrackerDispatchSchedulerOptions,
	TrackerReservedStart
} from './TrackerDispatchSchedulerService.types';

/** Reconcile committed attempts before reserving new work for the node. */
export class TrackerDispatchSchedulerService {
	private ticking = false;
	private readonly waits = new Map<string, { token: string; reason: string }>();
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
					: (this.waits.get(item.id)?.reason ?? 'ready but has not started')
			}))
		};
	}

	runnerStatus(limit = 100) {
		return {
			enabled: this.options.policy?.enabled !== false,
			last_tick_at: this.lastTickAt,
			last_error: this.lastError,
			...schedulerWaits(this.waits, limit)
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
			if (!(await this.reconcile(signal)))
				await requestNextCandidate(this.repository.candidates(), (candidate) =>
					this.claim(candidate, signal)
				);
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
				if (await this.release({ id: run.item_id, token: run.auto_token }, decision, signal))
					return true;
				continue;
			}
			const event = await observeReservedRun(run, this.options, signal);
			if (event) await this.dispatcher.record(run.item_id, run, event);
			else if (run.state === 'queued' && !this.waits.has(run.item_id))
				this.waits.set(run.item_id, {
					token: run.auto_token,
					reason: 'waiting for host startup evidence'
				});
		}
		return false;
	}

	private async claim(candidate: TrackerDispatchCandidate, signal: AbortSignal): Promise<boolean> {
		signal.throwIfAborted();
		const { id, auto, launch_source, launch_target } = candidate;
		const source = launch_source === 'due' ? 'due' : 'manual';
		if (auto) return this.claimIntent(id, { token: auto, source, target: launch_target }, signal);
		if (!this.options.scheduleDue) return false;
		const request = await this.dispatcher.request(id, { source: 'due', token: randomUUID() });
		return request.status === 'requested' && this.claimIntent(id, request.intent, signal);
	}

	private async claimIntent(id: string, intent: TrackerLaunchIntent, signal: AbortSignal) {
		const { policy, grant } = this.options;
		if (policy && !ownsLaunch(intent, policy)) return false;
		const permission =
			intent.source === 'due' ? await grant?.(id, intent.token, signal) : undefined;
		signal.throwIfAborted();
		return this.release(
			{ id, token: intent.token },
			await this.dispatcher.claim(id, intent.token, permission),
			signal
		);
	}

	private async release(
		{ id, token }: { id: string; token: string },
		result: TrackerDispatchResult,
		signal: AbortSignal
	) {
		if (result.status === 'held' && !this.waits.has(id))
			this.waits.set(id, { token, reason: result.reason });
		if (result.status !== 'start') return false;
		const { run } = result;
		const event = await startReservedRun(this.options.runner, result, signal);
		if (!event) {
			this.waits.set(run.item_id, {
				token: run.auto_token,
				reason: 'waiting for host startup evidence'
			});
			return false;
		}
		const observed = await this.dispatcher.record(run.item_id, run, event);
		return event.type === 'session' && observed.status === 'recorded';
	}
}

async function requestNextCandidate(
	candidates: readonly TrackerDispatchCandidate[],
	claim: (candidate: TrackerDispatchCandidate) => Promise<boolean>
) {
	for (const candidate of candidates) {
		if (await claim(candidate)) return;
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

function launchCompletionInstructions(itemId: string): string {
	return [
		'## Completion and worktree cleanup',
		'',
		`After verification passes, run \`tracker done ${itemId.slice(0, 6)} --note "<result, PR link, tests run>"\` first and verify it succeeds.`,
		'Remove a task-owned worktree only as the final step, after leaving it and only when authorized.',
		'Never remove your current working directory. Leave cleanup to the launcher or a separate session if you are still in the worktree.'
	].join('\n');
}
