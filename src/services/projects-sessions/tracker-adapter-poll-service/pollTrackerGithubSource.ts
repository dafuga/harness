// @harness-uid u_wlip653voz
import type { TrackerAdapterSourceRepository } from '../../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerAdapterSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterIntakeContext,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult,
	TrackerAdapterReadQuery,
	TrackerAdapterWriteError
} from '../TrackerAdapterPollService.types';
import { assertTrackerPollActive, TrackerAdapterPollError } from './trackerAdapterPollError';
import { readTrackerComments, readTrackerIssues } from './readTrackerIntake';

const overlapMs = 5_000;
const commentBackfillMs = 7 * 86_400_000;
const intakeError = 'Tracker adapter intake failed';
const writeBackError = 'Tracker adapter write-back failed';

export async function pollTrackerGithubSource(
	context: TrackerAdapterIntakeContext,
	sources: TrackerAdapterSourceRepository,
	source: TrackerAdapterSource,
	options: TrackerAdapterPollOptions & { signal: AbortSignal }
): Promise<TrackerAdapterPollResult> {
	const now = context.dependencies.now ?? Date.now;
	const startedAt = now();
	const { signal } = options;
	const dryRun = Boolean(options.dryRun);
	const commentsOnly = Boolean(options.backfillComments);
	const query = {
		since: commentsOnly ? startedAt - commentBackfillMs : source.cursor - overlapMs,
		backfill: Boolean(options.backfill),
		signal
	};
	try {
		const result = await pollIntake(context, source, query, { dryRun, commentsOnly });
		if (dryRun || commentsOnly) return { ...result, synced_back: 0, sync_errors: [] };
		sources.advance(source.id, startedAt);
		const sync = await syncTrackerAdapterWriteBack(context, source, signal);
		assertTrackerPollActive(signal);
		sources.recordRun(source.id, now(), sync.sync_errors[0]?.error ?? null);
		return { ...result, ...sync };
	} catch {
		assertTrackerPollActive(signal);
		if (!dryRun && !commentsOnly) sources.recordRun(source.id, now(), intakeError);
		throw new TrackerAdapterPollError(intakeError);
	}
}

async function pollIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	options: { dryRun: boolean; commentsOnly: boolean }
) {
	if (options.commentsOnly && query.backfill)
		throw new TypeError('Only one backfill mode is allowed');
	const issues = options.commentsOnly
		? { actions: [], events: 0 }
		: await readTrackerIssues(context, source, query, options.dryRun);
	const comments = await readTrackerComments(context, source, query, options);
	assertTrackerPollActive(query.signal);
	return {
		status: 'polled' as const,
		id: source.id,
		dry_run: options.dryRun,
		actions: [...issues.actions, ...comments.actions],
		events: issues.events + comments.events
	};
}

async function syncTrackerAdapterWriteBack(
	{ dependencies, repository }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	signal: AbortSignal
) {
	const { provider, hasStarted } = dependencies;
	const sync_errors: TrackerAdapterWriteError[] = [];
	let synced_back = 0;
	if (!provider.markTracked || !hasStarted) return { synced_back, sync_errors };
	for (const link of repository.pending(source.id)) {
		assertTrackerPollActive(signal);
		const item = repository.item(link.item_id);
		if (!item || item.deleted) continue;
		try {
			if (!hasStarted(item.id)) continue;
			await provider.markTracked(source, link.external_key, signal);
			assertTrackerPollActive(signal);
			repository.acknowledgeWrite(link);
			synced_back++;
		} catch {
			assertTrackerPollActive(signal);
			sync_errors.push({ external_id: link.external_id, error: writeBackError });
		}
	}
	return { synced_back, sync_errors };
}
