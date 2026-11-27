// @harness-uid u_welkl3cxo2
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerBoxJobAdmin } from '../tracker-recurring-service/trackerBoxJobAdmin.types';
import { readItemBody } from './trackerLocalItemMutation';

const unavailable =
	'box jobs run only on the hub, with recurrence enabled by a configured webhook and host effects active';

/** `/jobs` routes. Only this node's loopback API reaches them; sync peers cannot add commands. */
export async function trackerJobEndpoint(
	request: Request,
	[, reference, verb, ...rest]: string[],
	{ items, jobs }: { items: TrackerItemReadRepository; jobs?: TrackerBoxJobAdmin }
): Promise<unknown> {
	if (!jobs) throw trackerItemError(unavailable, 409);
	if (!reference && request.method === 'GET') return jobs.list();
	if (!reference || rest.length) return undefined;
	const route = `${request.method} ${verb ?? ''}`;
	if (route === 'DELETE ') return jobs.remove(items.resolve(reference));
	if (route === 'POST ') {
		const body = await readItemBody(request);
		request.signal.throwIfAborted();
		return jobs.set(items.resolve(reference), body);
	}
	if (route === 'POST test') return jobs.test(items.resolve(reference), request.signal);
	return undefined;
}
