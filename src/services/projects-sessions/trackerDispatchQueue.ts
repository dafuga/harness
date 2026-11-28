// @harness-uid u_4rnjtzp6cn
import { randomUUID } from 'node:crypto';
import { awaitStartEvidence, trackerStartError } from './trackerStartError';
import {
	automaticQueueHold,
	queuedRung,
	transferHeldTrackerLaunch
} from './tracker-native-runtime-service/trackerQueueAdmission';
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchCandidate } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type {
	TrackerDispatcherService,
	TrackerLaunchIntent,
	TrackerDispatchResult,
	TrackerLaunchRung,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';
import {
	ownsLaunch,
	schedulingHold
} from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchRunner,
	TrackerDispatchSchedulerOptions,
	TrackerReservedStart
} from './TrackerDispatchSchedulerService.types';

export class TrackerDispatchQueue {
	/** Refusals are kept apart: during a hub outage only due work can take a local fleet slot. */
	private readonly refusedSlots = new Set<'due' | 'other'>();

	constructor(
		private readonly repository: TrackerDispatchRepository,
		private readonly dispatcher: TrackerDispatcherService,
		private readonly options: TrackerDispatchSchedulerOptions,
		private readonly waits: Map<string, { token: string; reason: string }>
	) {}

	async retry(run: TrackerRunReceipt, signal: AbortSignal) {
		signal.throwIfAborted();
		const { item_id: id, auto_token: token } = run;
		const current = this.repository.readSnapshot(id).item;
		// Retire cancelled reservations even if the launch window is closed.
		if (
			current?.launch?.token === token &&
			!schedulingHold(current, policyNow(this.options)) &&
			!(await this.automaticPermission(id, current.launch, signal, queuedRung(run)))
		)
			return false;
		const decision = await prepareQueuedRun(run, this.dispatcher, this.options, signal);
		return this.release({ id, token }, decision, signal);
	}

	async claim(candidate: TrackerDispatchCandidate, signal: AbortSignal): Promise<boolean> {
		signal.throwIfAborted();
		const { id, auto, launch_source, launch_target } = candidate;
		const source =
			launch_source === 'due' || launch_source === 'recovery' || launch_source === 'automatic'
				? launch_source
				: 'manual';
		if (auto) return this.claimIntent(id, { token: auto, source, target: launch_target }, signal);
		if (!this.options.scheduleDue || this.refusedSlots.has('due')) return false;
		const request = await this.dispatcher.request(id, { source: 'due', token: randomUUID() });
		signal.throwIfAborted();
		return request.status === 'requested' && this.claimIntent(id, request.intent, signal);
	}

	private async claimIntent(id: string, intent: TrackerLaunchIntent, signal: AbortSignal) {
		const { policy, grant } = this.options;
		if (policy && !ownsLaunch(intent, policy)) return false;
		const permission =
			intent.source === 'due' ? await grant?.(id, intent.token, signal) : undefined;
		signal.throwIfAborted();
		const allowed =
			permission?.decision === 'denied'
				? !this.transferHeldDue(id, intent)
				: await this.permitIntent(id, intent, signal);
		if (!allowed) return false;
		signal.throwIfAborted();
		return this.release(
			{ id, token: intent.token },
			await this.dispatcher.claim(id, intent.token, permission),
			signal
		);
	}

	private async automaticPermission(
		id: string,
		intent: TrackerLaunchIntent,
		signal: AbortSignal,
		queued?: TrackerLaunchRung
	) {
		const { policy, permitAutomatic } = this.options;
		if (!permitAutomatic) return true;
		const now = policyNow(this.options);
		const { item, runs } = this.repository.readSnapshot(id);
		const hold = automaticQueueHold(item, { policy, intent, now, queued, runs });
		if (hold) {
			const moved = transferHeldTrackerLaunch(this.repository, this.options, {
				item,
				intent,
				hold
			});
			this.waits.set(id, { token: intent.token, reason: moved ?? hold });
			return false;
		}
		const refused = !(await takeFleetSlot(this.refusedSlots, { id, intent }, this.options, signal));
		if (refused)
			this.waits.set(id, {
				token: intent.token,
				reason: 'automatic launch waiting for a fleet slot'
			});
		return !refused;
	}

	private permitIntent(id: string, intent: TrackerLaunchIntent, signal: AbortSignal) {
		return intent.source === 'manual' || this.automaticPermission(id, intent, signal);
	}

	private transferHeldDue(id: string, intent: TrackerLaunchIntent) {
		const item = this.repository.readSnapshot(id).item;
		const { policy } = this.options;
		const hold = automaticQueueHold(item, { policy, intent, now: policyNow(this.options) });
		const moved =
			hold && transferHeldTrackerLaunch(this.repository, this.options, { item, intent, hold });
		if (moved) this.waits.set(id, { token: intent.token, reason: moved });
		return Boolean(moved);
	}

	private async release(
		{ id, token }: { id: string; token: string },
		result: TrackerDispatchResult,
		signal: AbortSignal
	) {
		signal.throwIfAborted();
		if (result.status === 'held' && !this.waits.has(id))
			this.waits.set(id, { token, reason: result.reason });
		if (result.status !== 'start') return false;
		const { run } = result;
		const event = await startReservedRun(this.options.runner, result, signal);
		signal.throwIfAborted();
		if (!event || (event.type === 'startup-failed' && event.pending))
			return awaitStartEvidence({ waits: this.waits, dispatcher: this.dispatcher }, run, event);
		const observed = await this.dispatcher.record(run.item_id, run, event);
		return event.type === 'session' && observed.status === 'recorded';
	}
}

async function takeFleetSlot(
	refusedSlots: Set<'due' | 'other'>,
	{ id, intent }: { id: string; intent: TrackerLaunchIntent },
	{ permitAutomatic }: TrackerDispatchSchedulerOptions,
	signal: AbortSignal
) {
	const lane = intent.source === 'due' ? 'due' : 'other';
	if (
		!refusedSlots.has(lane) &&
		!(await permitAutomatic?.(id, intent.token, signal, intent.source))
	)
		refusedSlots.add(lane);
	signal.throwIfAborted();
	return !refusedSlots.has(lane);
}

function policyNow({ policy }: TrackerDispatchSchedulerOptions) {
	return (policy?.now ?? Date.now)();
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
	} catch (error) {
		// The host might have started the session before losing its reply.
		return trackerStartError(error instanceof Error ? error.message : String(error));
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
