// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { rejectionReason } from '../../agents-providers/tracker-dispatcher-service/runReview';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { readItemBody } from './trackerLocalItemMutation';

/** Daniel rejects a completed result: reopen the item and charge the auto-run that produced it. */
export async function trackerRejectItem(
	request: Request,
	reference: string,
	{
		store,
		items,
		options,
		actor
	}: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		options: TrackerLocalApiOptions;
		actor: string | null;
	}
) {
	if (actor?.startsWith('tracker-run-'))
		throw trackerItemError('a launched run cannot reject results', 403);
	const body = await readItemBody(request);
	request.signal.throwIfAborted();
	const reason = String(body.reason ?? '');
	const item = items.resolve(reference);
	if (item.every) throw trackerItemError('recurring items cannot be rejected', 409);
	guardRunOwner(item.id, store.node, options);
	const run = options.reject
		? await rejectManaged(item.id, reason, options.reject)
		: reopenUnmanaged(store, items, { itemId: item.id, reason, actor });
	return { ...items.getStored(item.id), rejected_run: run };
}

function guardRunOwner(itemId: string, node: string, { runs }: TrackerLocalApiOptions) {
	const done = (runs?.list({ itemId }) ?? []).filter((run) => run.outcome === 'done');
	const [latest] = done.sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0));
	if (latest?.node && latest.node !== node)
		throw trackerItemError(`run tracker reject on ${latest.node}, which owns the run`, 409);
}

async function rejectManaged(
	itemId: string,
	reason: string,
	reject: NonNullable<TrackerLocalApiOptions['reject']>
) {
	const result = await reject(itemId, reason);
	if (result.status === 'conflict') throw trackerItemError(result.reason, 409);
	return result.status === 'recorded' ? { id: result.run.id, rung: result.run.rung } : null;
}

/** A computer without a launcher has no auto-run to charge. */
function reopenUnmanaged(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	{ itemId, reason, actor }: { itemId: string; reason: string; actor: string | null }
) {
	if (items.getStored(itemId).status !== 'done')
		throw trackerItemError('only a completed item can be rejected', 409);
	const note = `rejected: ${rejectionReason(reason)}`;
	store.appendLocal({ itemId, fields: { status: 'open', 'note+': note }, actor });
	return null;
}
