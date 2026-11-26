// @harness-uid u_bl6xl2h4a3
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchPort,
	TrackerHostRoute,
	TrackerHostTarget
} from './trackerHostLaunch.types';
import { withTrackerRunUsage } from './trackerHostLaunchPort';
import type { trackerHostVerification } from './trackerHostVerification';

/** Add a starting run's checkout, final usage and verification to what the host observed. */
export function trackerHostReport(
	{
		store,
		driver,
		routeFor,
		now
	}: {
		store: TrackerPersistenceService;
		driver: TrackerHostLaunchPort;
		routeFor: TrackerHostRoute;
		now: () => number;
	},
	verification: ReturnType<typeof trackerHostVerification>
) {
	const items = new TrackerItemReadRepository(store.database);
	const report = async (
		event: TrackerDispatchEvent | undefined,
		run: TrackerRunReceipt,
		signal: AbortSignal
	) => {
		const route = run.state === 'queued' && routeFor(items.getStored(run.item_id));
		const observed = await withTrackerRunUsage(
			withSourceRepo(event, route),
			{ driver, run, items, now: now() },
			signal
		);
		return verification.event(observed, { run, database: store.database }, signal);
	};
	return Object.assign(report, { retain: verification.retain });
}

/** A starting run records the checkout it came from. */
export function withSourceRepo(
	event: TrackerDispatchEvent | undefined,
	route: TrackerHostTarget | false | undefined
): TrackerDispatchEvent | undefined {
	if (event?.type !== 'session' || !route || !('repo' in route)) return event;
	return { ...event, session: { ...event.session, sourceRepo: route.repo } };
}
