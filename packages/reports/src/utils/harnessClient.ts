import type { StoredSide } from '../../../../src/utils/sideImpact';
import type { HarnessIndex, HarnessRevision } from '../models/Harness.types';

export interface HarnessClient {
	index(): Promise<HarnessIndex>;
	revision(commit: string): Promise<HarnessRevision>;
	/** The stored side of a source tree, by the path a revision names. */
	side(path: string): Promise<StoredSide>;
}

/**
 * Fetches console data on demand from the protected endpoints. The index is one request; a
 * revision's detail is fetched only when that revision is looked at, and media only when shown.
 */
export function harnessClient(base: string, fetcher: typeof fetch = fetch): HarnessClient {
	const cache = new Map<string, Promise<unknown>>();
	const load = <Result>(path: string): Promise<Result> => {
		const pending =
			cache.get(path) ??
			fetcher(`${base}/data/${path}`).then((response) => {
				if (!response.ok) throw new Error(`${path} could not be loaded (${response.status})`);
				return response.json() as Promise<unknown>;
			});
		cache.set(path, pending);
		pending.catch(() => cache.delete(path));
		return pending as Promise<Result>;
	};
	return {
		index: () => load<HarnessIndex>('index.json'),
		revision: (commit) => load<HarnessRevision>(`revisions/${commit}.json`),
		side: (path) => load<StoredSide>(path)
	};
}
