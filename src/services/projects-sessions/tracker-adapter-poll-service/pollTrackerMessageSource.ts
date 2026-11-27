// @harness-uid u_wlip653voz
import type { TrackerAdapterSourceRepository } from '../../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerMessageSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterIntakeContext,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult
} from '../TrackerAdapterPollService.types';
import { readTrackerMessageIntake, trackerMessageQuiet } from './readTrackerMessageIntake';
import { assertTrackerPollActive, TrackerAdapterPollError } from './trackerAdapterPollError';

const messageOverlapMs = 60 * 60_000;
const intakeError = 'Tracker adapter intake failed';

export async function pollTrackerMessageSource(
	context: TrackerAdapterIntakeContext,
	sources: TrackerAdapterSourceRepository,
	source: TrackerMessageSource,
	options: TrackerAdapterPollOptions & { signal: AbortSignal }
): Promise<TrackerAdapterPollResult> {
	const { dryRun = false, backfill, backfillComments, signal } = options;
	const now = context.dependencies.now ?? Date.now;
	const startedAt = now();
	const base = {
		status: 'polled' as const,
		id: source.id,
		dry_run: dryRun,
		synced_back: 0,
		sync_errors: []
	};
	try {
		if ([backfill, backfillComments].some(Boolean))
			throw new TypeError('Message adapters do not backfill');
		if (!dryRun && trackerMessageQuiet(source, startedAt)) {
			sources.recordRun(source.id, startedAt, null);
			return { ...base, actions: [], events: 0, deferred: true };
		}
		const query = {
			since: Math.max(source.enabled_at, source.cursor - messageOverlapMs),
			backfill: false,
			signal
		};
		const result = await readTrackerMessageIntake(context, source, { query, dryRun });
		assertTrackerPollActive(signal);
		if (!dryRun) {
			if (!result.deferred) sources.advance(source.id, startedAt);
			sources.recordRun(source.id, now(), null);
		}
		return { ...base, ...result };
	} catch {
		assertTrackerPollActive(signal);
		if (!dryRun) sources.recordRun(source.id, now(), intakeError);
		throw new TrackerAdapterPollError(intakeError);
	}
}
