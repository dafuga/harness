// @harness-uid u_4rnjtzp6cn
import { trackerHostCapacityHold } from './tracker-native-runtime-service/trackerHostAdmission';
import { randomUUID } from 'node:crypto';
import { awaitStartEvidence, trackerStartError } from './trackerStartError';
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerDispatchCandidate } from '../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type {
	TrackerDispatcherService,
	TrackerLaunchIntent,
	TrackerDispatchResult,
	TrackerDispatchPolicy,
	TrackerDispatchItem,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService';
import {
	automaticQuietHour,
	automaticRequestHold,
	ownsLaunch,
	schedulingHold
} from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchRunner,
	TrackerDispatchSchedulerOptions,
	TrackerReservedStart
} from './TrackerDispatchSchedulerService.types';

export class TrackerDispatchQueue {
	private automaticSlotHeld = false;

	constructor(
		private readonly repository: TrackerDispatchRepository,
		private readonly dispatcher: TrackerDispatcherService,
		private readonly options: TrackerDispatchSchedulerOptions,
		private readonly waits: Map<string, { token: string; reason: string }>
	) {}

	async retry(run: TrackerRunReceipt, signal: AbortSignal) {
		const { item_id: id, auto_token: token } = run;
		const current = this.repository.readSnapshot(id).item;
		// Retire cancelled reservations even if the launch window is closed.
		if (
			current?.launch?.token === token &&
			!schedulingHold(current, policyNow(this.options)) &&
			!(await this.automaticPermission(id, current.launch, signal))
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
		if (
			!this.options.scheduleDue ||
			this.automaticSlotHeld ||
			(this.options.permitAutomatic && automaticQuietHour(policyNow(this.options)))
		)
			return false;
		const request = await this.dispatcher.request(id, { source: 'due', token: randomUUID() });
		return request.status === 'requested' && this.claimIntent(id, request.intent, signal);
	}

	private async claimIntent(id: string, intent: TrackerLaunchIntent, signal: AbortSignal) {
		const { policy, grant } = this.options;
		if (policy && !ownsLaunch(intent, policy)) return false;
		const permission =
			intent.source === 'due' ? await grant?.(id, intent.token, signal) : undefined;
		signal.throwIfAborted();
		if (
			permission?.decision !== 'denied' &&
			intent.source !== 'manual' &&
			!(await this.automaticPermission(id, intent, signal))
		)
			return false;
		return this.release(
			{ id, token: intent.token },
			await this.dispatcher.claim(id, intent.token, permission),
			signal
		);
	}

	private async automaticPermission(id: string, intent: TrackerLaunchIntent, signal: AbortSignal) {
		const { policy, permitAutomatic } = this.options;
		if (!permitAutomatic) return true;
		const now = policyNow(this.options);
		const item = this.repository.readSnapshot(id).item;
		const hold = automaticQueueHold(item, { policy, intent, now });
		if (hold) {
			const moved =
				item && hold === trackerHostCapacityHold && !automaticQuietHour(now)
					? this.delegate(item, intent)
					: undefined;
			this.waits.set(id, { token: intent.token, reason: moved ?? hold });
			return false;
		}
		if (!this.automaticSlotHeld)
			this.automaticSlotHeld = !(await permitAutomatic(id, intent.token, signal));
		signal.throwIfAborted();
		if (this.automaticSlotHeld)
			this.waits.set(id, {
				token: intent.token,
				reason: 'automatic launch waiting for a fleet slot'
			});
		return !this.automaticSlotHeld;
	}

	private delegate(item: TrackerDispatchItem, intent: TrackerLaunchIntent) {
		const alternate = this.options.alternateAdapterHost?.(item, item.launch ?? intent);
		if (
			alternate &&
			this.repository.launches.reassignAdapterLaunch(item.id, intent.token, alternate)
		)
			return `tester intake queued on ${alternate}`;
		return undefined;
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
		if (!event || (event.type === 'startup-failed' && event.pending))
			return awaitStartEvidence({ waits: this.waits, dispatcher: this.dispatcher }, run, event);
		const observed = await this.dispatcher.record(run.item_id, run, event);
		return event.type === 'session' && observed.status === 'recorded';
	}
}

function automaticQueueHold(
	item: TrackerDispatchItem | null,
	{
		policy,
		intent,
		now
	}: { policy?: TrackerDispatchPolicy; intent: TrackerLaunchIntent; now: number }
) {
	if (!item || item.launch?.token !== intent.token) return 'launch request changed or is missing';
	if (!policy) return null;
	return (
		automaticRequestHold(item, policy, now) ??
		(automaticQuietHour(now) ? 'automatic launch night hold' : policy.admit(item, intent, null))
	);
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
