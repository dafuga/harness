// @harness-uid u_pg5geo3ouj
import { TrackerRecurringRepository } from '../../../repositories/projects-sessions/TrackerRecurringRepository';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerNotificationService } from '../TrackerNotificationService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerRecurringService } from '../TrackerRecurringService';

export function composeTrackerRecurrence(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	notifications?: TrackerNotificationService
) {
	if (!options.recurring || !notifications) return undefined;
	const repo = new TrackerRecurringRepository(store);
	const worker = new TrackerRecurringService(repo, {
		now: options.now ?? Date.now,
		enqueue: (entry) => notifications.enqueue(entry),
		jobs: options.recurring.jobs
	});
	return { repo, worker };
}
