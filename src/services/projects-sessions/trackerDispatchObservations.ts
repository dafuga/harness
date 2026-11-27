// @harness-uid u_4rnjtzp6cn
import type { TrackerDispatchRepository } from '../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerRunReceipt } from '../agents-providers/TrackerDispatcherService';
import { attemptKey } from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import { launchStartupGrace } from '../agents-providers/tracker-dispatcher-service/runClaim';
import type {
	TrackerDispatchRunner,
	TrackerDispatchSchedulerOptions
} from './TrackerDispatchSchedulerService.types';

export function schedulerWaits(
	waits: ReadonlyMap<string, { token: string; reason: string }>,
	limit: number
) {
	const entries = [...waits].slice(0, limit);
	return {
		waiting_on: entries[0]?.[1].reason ?? null,
		waiting: Object.fromEntries(entries.map(([id, { reason }]) => [id, reason])),
		waiting_tokens: Object.fromEntries(entries.map(([id, { token }]) => [id, token]))
	};
}

export async function observeReservedRun(
	run: TrackerRunReceipt,
	options: TrackerDispatchSchedulerOptions,
	signal: AbortSignal
) {
	const event = await options.runner.observe(run, attemptKey(run), signal);
	signal.throwIfAborted();
	return event ?? (await expiredStartEvent(run, options, signal));
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

export async function reconcileLegacyRuns(
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
