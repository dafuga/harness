// @harness-uid u_ziucb423ne
import type { InboxReply } from '../../../models/development-tooling/TrackerInbox.types';

const trackerOrigin = 'http://127.0.0.1:7701';

export function trackerRequest(path: string, init?: RequestInit): Promise<Response> {
	return fetch(trackerOrigin + path, {
		...init,
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		signal: AbortSignal.timeout(5000)
	});
}

export async function readReply<T>(response: Response): Promise<T> {
	if (response.ok) return (await response.json()) as T;
	await response.body?.cancel();
	throw new TypeError('Tracker did not return item data');
}

export async function writeError(response: Response): Promise<string> {
	const { code } = (await response.json()) as { code?: string };
	if (code === 'staleReview') return code;
	if (response.status === 404) return 'noLocalMatch';
	if (response.status === 400) return 'invalidInput';
	if (response.status === 409) return 'writeConflict';
	return 'unavailable';
}

/** Whether the local change feed answers, for a window that has not heard a push yet. */
export async function liveState(): Promise<InboxReply<never>> {
	try {
		const response = await trackerRequest('/changes');
		await response.body?.cancel();
		return response.ok ? current({}) : unavailable();
	} catch {
		return unavailable();
	}
}

export function current<T>(result: { value?: T; code?: string }): InboxReply<T> {
	return { ...result, freshness: 'current', lastSyncedAt: null, partial: false };
}

export function unavailable(): InboxReply<never> {
	return { code: 'unavailable', freshness: 'unavailable', lastSyncedAt: null, partial: true };
}
