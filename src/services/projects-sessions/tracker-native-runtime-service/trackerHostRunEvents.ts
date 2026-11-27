// @harness-uid u_bl6xl2h4a3
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerHostSession } from './trackerHostLaunch.types';
import { trackerHostStartupEvent, trackerItemStatus } from './trackerHostLaunchPort';

export function recordedHostEvent(
	run: TrackerRunReceipt,
	{
		key,
		sessions,
		items,
		legacySession
	}: {
		key: string;
		sessions: readonly TrackerHostSession[];
		items: TrackerItemReadRepository;
		legacySession: (run: TrackerRunReceipt) => TrackerHostSession | undefined;
	}
): TrackerDispatchEvent | undefined {
	const session = run.host_session_id
		? legacySession(run)
		: sessions.find(
				(entry) => !entry.legacyRunId && entry.key === key && entry.itemId === run.item_id
			);
	if (run.state === 'queued') return trackerHostStartupEvent(session);
	if (!session || session.id !== (run.host_session_id ?? run.session_id))
		return run.outcome === 'blocked'
			? answeredClosedBlock(run, items)
			: missingSessionEvent(run, items);
	if (run.outcome === 'blocked' && session.state === 'live') return { type: 'resume', session };
	if (run.outcome === 'blocked') return answeredClosedBlock(run, items);
	return {
		type: 'monitor',
		session: session.state,
		activityAt: session.activityAt,
		exitCode: session.exitCode,
		diagnostic: session.diagnostic
	};
}

function missingSessionEvent(
	run: TrackerRunReceipt,
	items: TrackerItemReadRepository
): TrackerDispatchEvent | undefined {
	return trackerItemStatus(items, run.item_id) === 'done'
		? { type: 'monitor', session: 'unknown' }
		: undefined;
}

/** A current answer can reopen a started blocked run after its original session has gone. */
function answeredClosedBlock(
	run: TrackerRunReceipt,
	items: TrackerItemReadRepository
): TrackerDispatchEvent | undefined {
	if (run.started_at === null || run.ended_at === null) return undefined;
	const item = items.getStored(run.item_id);
	const answeredAt = Date.parse(item.answered_at ?? '');
	return item.status === 'blocked' && item.resolved && answeredAt >= run.started_at
		? { type: 'answered-without-session' }
		: undefined;
}
