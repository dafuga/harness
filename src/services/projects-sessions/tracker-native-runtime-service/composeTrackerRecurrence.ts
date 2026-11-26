// @harness-uid u_bnyzx2vypr
import { TrackerRecurringRepository } from '../../../repositories/projects-sessions/TrackerRecurringRepository';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerNotificationService } from '../TrackerNotificationService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerRecurringService } from '../TrackerRecurringService';
import { trackerBoxJobAdmin } from '../tracker-recurring-service/trackerBoxJobAdmin';

/** The hub's schedule worker, and its `tracker job` commands when it has a job runner. */
export function composeTrackerRecurrence(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	notifications?: TrackerNotificationService
) {
	if (!options.recurring || !notifications) return undefined;
	const repo = new TrackerRecurringRepository(store);
	const { jobs: runner } = options.recurring;
	const now = options.now ?? Date.now;
	const worker = new TrackerRecurringService(repo, {
		now,
		enqueue: (entry) => notifications.enqueue(entry),
		jobs: runner
	});
	return { repo, worker, jobs: runner && trackerBoxJobAdmin(repo, runner, now) };
}
