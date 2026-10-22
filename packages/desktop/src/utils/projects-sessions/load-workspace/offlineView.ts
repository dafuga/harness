import type { OfflineView } from '../cache-status/cacheStatus';
import type { ProjectSnapshot } from '../../../models/development-tooling/Desktop.types';

/** What a snapshot says about being a cached copy; null for a current one. */
export function offlineView(snapshot: ProjectSnapshot): OfflineView | null {
	const cache = snapshot.cache;
	const cached = cache && (cache.status === 'offline' || cache.readOnly === true);
	return cached ? { cachedAt: cache.cachedAt ?? null } : null;
}
