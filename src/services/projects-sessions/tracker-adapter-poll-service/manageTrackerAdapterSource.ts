// @harness-uid u_wlip653voz
import type { TrackerAdapterOwner } from './manageTrackerAdapterSource.types';
import type {
	TrackerStoredAdapterSource,
	TrackerAdapterSourceAction
} from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type { TrackerAdapterRepository } from '../../../repositories/projects-sessions/TrackerAdapterRepository';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';

export function addTrackerAdapterSource(
	owner: TrackerAdapterOwner,
	source: TrackerStoredAdapterSource
) {
	return whileOwning(owner, () => {
		if (!owner.sources.add(source)) throw trackerItemError('adapter already exists', 409);
		return { id: source.id, enabled_at: source.enabled_at };
	});
}

export function changeTrackerAdapterSource(
	owner: TrackerAdapterOwner,
	id: string,
	action: TrackerAdapterSourceAction
) {
	return whileOwning(owner, () => {
		if (!owner.sources.change(id, action)) throw trackerItemError('adapter not found', 404);
		return action === 'remove' ? { id, removed: true } : { id, paused: action === 'pause' };
	});
}

/** Sources change only on their runner, and never underneath a poll that holds the lease. */
function whileOwning<Result>(
	{ sources, lease, node }: TrackerAdapterOwner,
	change: () => Result
): Result {
	const elsewhere = 'Run adapters on the designated Tracker runner';
	if (node !== lease.owner) throw trackerItemError(elsewhere, 409);
	const release = lease.tryAcquire();
	if (!release) throw trackerItemError('an adapter poll is running; try again shortly', 409);
	try {
		sources.initialize();
		if (!sources.isOwner(node, true)) throw trackerItemError(elsewhere, 409);
		return change();
	} finally {
		release();
	}
}

/** An unsaved source has no links, and its tables may not exist: only manual items can match. */
export function unlinkedRepository(repository: TrackerAdapterRepository): TrackerAdapterRepository {
	return Object.assign(Object.create(repository) as TrackerAdapterRepository, {
		link: () => undefined,
		linkByKey: () => undefined,
		hasFollowUp: () => false
	});
}
