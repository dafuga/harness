// @harness-uid u_jkomno4o5u
import type { TrackerHubOptions } from '../TrackerHubSyncService.types';
import type { TrackerHubPolls } from './TrackerHubPolls';
import { trackerHubResponse } from './hubHttp';
import { TrackerHubInputError } from './TrackerHubInputError';

export async function readJournalPage(
	options: TrackerHubOptions,
	polls: TrackerHubPolls,
	query: URLSearchParams,
	signal: AbortSignal | undefined
): Promise<Response> {
	const { store, duePolicy } = options;
	const since = nonnegativeInteger(query, 'since', 0);
	const limit = Math.min(nonnegativeInteger(query, 'limit', 1000), 5000);
	const wait = Math.min(nonnegativeNumber(query, 'wait', 0), 60) * 1000;
	let ops = store.opsSince(since, limit);
	if (ops.length === 0 && wait > 0 && store.maxSeq() >= since) {
		await polls.wait(wait, signal);
		signal?.throwIfAborted();
		ops = store.opsSince(since, limit);
	}
	const max = store.maxSeq();
	return trackerHubResponse(200, {
		ops,
		last: ops.at(-1)?.seq ?? Math.min(since, max),
		max,
		db_id: store.dbId,
		hub: store.node,
		due_policy: duePolicy?.()
	});
}

function nonnegativeNumber(query: URLSearchParams, key: string, fallback: number): number {
	const parameter = query.get(key);
	const value = parameter === null || parameter === '' ? fallback : Number(parameter);
	if (!Number.isFinite(value) || value < 0) throw new TrackerHubInputError(400, `invalid ${key}`);
	return value;
}

function nonnegativeInteger(query: URLSearchParams, key: string, fallback: number): number {
	const value = nonnegativeNumber(query, key, fallback);
	if (!Number.isSafeInteger(value)) throw new TrackerHubInputError(400, `invalid ${key}`);
	return value;
}
