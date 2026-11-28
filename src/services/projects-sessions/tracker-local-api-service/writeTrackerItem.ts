// @harness-uid u_g7kdpz7bel
import { cancelQueuedDispatchRuns } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchLaunchControl';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { recordCosFlag } from './recordCosFlag';
import { writeChiefReview } from './trackerChiefReview';
import { readActor } from './trackerLocalActor';
import {
	itemAction,
	itemMutation,
	itemMutationContext,
	readItemBody,
	recordTrackerSessionItem,
	trackerMutationBody
} from './trackerLocalItemMutation';
import { trackerResponse } from './trackerLocalResponse';
import { isTrackerManualLaunch, planTrackerManualLaunch } from './trackerManualLaunch';
import type { TrackerItemRoute, TrackerItemWrite } from './writeTrackerItem.types';

/** Handles the core item changes: reviewed answers first, then ordinary transitions. */
export async function writeTrackerItem(
	request: Request,
	[, id, verb]: string[],
	ports: TrackerLocalApiDependencies
): Promise<Response | undefined> {
	const route = itemRoute(request.method, { id, verb }, ports);
	if (!route) return undefined;
	const input = await readItemBody(request);
	request.signal.throwIfAborted();
	const actor = readActor(request.headers);
	const reviewed = id && writeChiefReview(ports, id, { verb, actor, body: input });
	if (reviewed) return reviewed;
	if (route.release) return trackerResponse(404, { error: 'review queue unavailable' });
	return applyItemWrite(ports, route, { actor, input });
}

function itemRoute(
	method: string,
	{ id, verb }: { id: string; verb: string | undefined },
	{ options }: TrackerLocalApiDependencies
): TrackerItemRoute | undefined {
	const action = itemAction(method, id, verb);
	const posted = method === 'POST' && Boolean(id);
	const manual = Boolean(options.manualLaunch) && posted && isTrackerManualLaunch(verb);
	const release = posted && verb === 'release';
	return action || manual || release ? { id, verb, action, manual, release } : undefined;
}

function applyItemWrite(
	ports: TrackerLocalApiDependencies,
	route: TrackerItemRoute,
	{ actor, input }: TrackerItemWrite
): Response {
	const { store, items } = ports;
	const { id, verb, action } = route;
	const context = itemMutationContext(store, items, ports.options, verb === 'launch');
	const body = trackerMutationBody(input, action, actor, Boolean(context.planLaunch));
	const plan = action
		? planTrackerItemMutation(itemMutation(action, id, body, items), context)
		: planTrackerManualLaunch(verb as never, items.resolve(id), body, context);
	const persist = () => {
		if (action === 'start') recordTrackerSessionItem(store.database, plan.itemId, body.session_run);
		if (route.manual && verb === 'unlaunch')
			cancelQueuedDispatchRuns(store, plan.itemId, context.now);
	};
	// A flag addressed to Chief of Staff changes no item fields: its channel carries the text.
	const cosOnly =
		store.chiefReview &&
		action === 'flag' &&
		typeof body.question === 'string' &&
		!plan.fields?.needs_daniel;
	if (!cosOnly && plan.fields)
		store.appendLocal({ itemId: plan.itemId, fields: plan.fields, actor }, persist);
	recordCosFlag(store, { itemId: plan.itemId, action, question: body.question }, context.now);
	const stored = items.getStored(plan.itemId);
	return trackerResponse(action === 'add' ? 201 : 200, {
		...stored,
		...(cosOnly && { review_status: 'awaiting Chief of Staff review' })
	});
}
