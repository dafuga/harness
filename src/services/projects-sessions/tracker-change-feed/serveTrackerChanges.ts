import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { readTrackerChangeCursor } from './readTrackerChangeCursor';

/** The longest one request waits; below the API listener's 30 s idle timeout. */
const maxWaitSeconds = 25;
/** How often a waiting request looks for writes that bypass the journal, such as run states. */
const checkMs = 200;

/**
 * `GET /changes?cursor=C&wait=S`: answers as soon as the tracker no longer stands at cursor C,
 * or after S seconds with the same cursor. It carries no tracker content; the client reads again.
 */
export async function serveTrackerChanges(
	request: Request,
	store: TrackerPersistenceService
): Promise<Response> {
	const query = new URL(request.url).searchParams;
	const since = query.get('cursor');
	const wait = Math.min(Math.max(Number(query.get('wait')) || 0, 0), maxWaitSeconds);
	const cursor =
		since && wait
			? await nextCursor(store, { since, ms: wait * 1000, signal: request.signal })
			: readTrackerChangeCursor(store);
	return Response.json(
		{ cursor, changed: cursor !== since },
		{ headers: { 'cache-control': 'no-store' } }
	);
}

function nextCursor(
	store: TrackerPersistenceService,
	options: { since: string; ms: number; signal: AbortSignal }
): Promise<string> {
	return new Promise((resolve) => {
		const check = (force = false) => {
			const cursor = readTrackerChangeCursor(store);
			if (cursor === options.since && !force) return;
			clearInterval(poll);
			clearTimeout(deadline);
			unsubscribe();
			options.signal.removeEventListener('abort', stop);
			resolve(cursor);
		};
		const stop = () => check(true);
		const poll = setInterval(() => check(), checkMs);
		const deadline = setTimeout(stop, options.ms);
		const unsubscribe = store.subscribe(() => queueMicrotask(() => check()));
		options.signal.addEventListener('abort', stop, { once: true });
		if (options.signal.aborted) stop();
		else check();
	});
}
