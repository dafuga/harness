// @harness-uid u_yd5wcp6sz3
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { OverviewOutcome } from './overviewClient.types';

/** The owner endpoint of this site; the page sends GET to it and nothing else. */
export const overviewPath = '/api/tracker-overview';

/** Event-driven reads are spaced at least this far apart, and the timer uses the same spacing. */
const every = 20000;

const unavailable: OverviewSnapshot = { status: 'unavailable' };

/** A body is shown only when it has the ready shape; anything else reads as unavailable. */
function snapshotOf(body: unknown): OverviewSnapshot {
	if (!body || typeof body !== 'object') return unavailable;
	const value = body as Record<string, unknown>;
	if (
		value.status === 'unavailable' &&
		(value.reason === 'stale' || value.reason === 'host-revoked')
	)
		return { status: 'unavailable', reason: value.reason };
	const ready =
		value.status === 'ready' &&
		Array.isArray(value.projects) &&
		Array.isArray(value.machines) &&
		typeof value.liveSessions === 'number';
	return ready ? (body as OverviewSnapshot) : unavailable;
}

/**
 * Reads the owner overview: same origin, no store, no credential in the address or a header the
 * page can see. 200 and 503 both mean this account is the owner; 401, 403 and 404 mean it is not.
 */
export async function readOverview(
	fetcher: typeof fetch = fetch,
	signal?: AbortSignal
): Promise<OverviewOutcome> {
	let response: Response;
	try {
		response = await fetcher(overviewPath, {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { Accept: 'application/json' },
			signal
		});
	} catch {
		return { kind: 'failed' };
	}
	if (response.status === 401 || response.status === 403 || response.status === 404) {
		return { kind: 'denied' };
	}
	if (response.status !== 200 && response.status !== 503) return { kind: 'failed' };
	const body: unknown = await response.json().catch(() => null);
	return { kind: 'owner', snapshot: snapshotOf(body) };
}

/**
 * Calls `refresh` while the page is visible: once per interval and on focus or becoming visible,
 * never more often than every 20 seconds. Returns the function that stops it.
 */
export function watchWhileVisible(refresh: () => void): () => void {
	let last = 0;
	const run = () => {
		if (document.visibilityState !== 'visible') return;
		const now = Date.now();
		if (now - last < every) return;
		last = now;
		refresh();
	};
	const timer = setInterval(run, every);
	document.addEventListener('visibilitychange', run);
	window.addEventListener('focus', run);
	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', run);
		window.removeEventListener('focus', run);
	};
}
