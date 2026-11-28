// @harness-uid u_bl6xl2h4a3
import { basename } from 'node:path';
import { trackerSessionLabel } from '../../../utils/projects-sessions/trackerSessionNames';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchPort,
	TrackerHostRoute,
	TrackerHostTarget,
	TrackerHostVerifyCommand
} from './trackerHostLaunch.types';
import { withTrackerRunUsage } from './trackerHostLaunchPort';
import { trackerHostVerification } from './trackerHostVerification';

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
	verifyCommand?: TrackerHostVerifyCommand
) {
	const items = new TrackerItemReadRepository(store.database);
	const verification = trackerHostVerification(driver, verifyCommand);
	const report = async (
		event: TrackerDispatchEvent | undefined,
		run: TrackerRunReceipt,
		signal: AbortSignal
	) => {
		const item = run.state === 'queued' && items.getStored(run.item_id);
		const observed = await withTrackerRunUsage(
			withLaunchOrigin(event, item && routeFor(item), item),
			{ driver, run, items, now: now() },
			signal
		);
		signal.throwIfAborted();
		return verification.event(observed, { run, database: store.database }, signal);
	};
	return Object.assign(report, { retain: verification.retain });
}

/** A starting run records the checkout it came from and the name its session was given. */
export function withLaunchOrigin(
	event: TrackerDispatchEvent | undefined,
	route: TrackerHostTarget | false | undefined,
	item: TrackerItem | false
): TrackerDispatchEvent | undefined {
	if (event?.type !== 'session' || !route || !item) return event;
	const sessionName = trackerRouteSessionName(item, route);
	return {
		...event,
		session: { ...event.session, sessionName, ...('repo' in route && { sourceRepo: route.repo }) }
	};
}

export function trackerRouteSessionName(item: TrackerItem, route: TrackerHostTarget) {
	return trackerSessionLabel(item, basename('repo' in route ? route.repo : route.workdir));
}
