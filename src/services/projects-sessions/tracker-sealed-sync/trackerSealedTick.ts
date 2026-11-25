// @harness-uid u_ilwvw422yo
import { TrackerNodeTransportError } from '../tracker-node-service/TrackerNodeTransportError';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { TrackerOperationRepository } from '../../../repositories/projects-sessions/TrackerOperationRepository';
import { replayTrackerSealedJournal } from './replayTrackerSealedJournal';
import { TrackerSealedJournal } from './TrackerSealedJournal';
import { TrackerSealedSyncService } from './TrackerSealedSyncService';
import type { TrackerSealedNodeOptions } from './TrackerSealedSyncService.types';

/** Attach sealed replication only when trusted enrollment supplies device and scope bindings. */
export function trackerSealedTicks(
	database: SqliteDatabase,
	localNode: string,
	scopes: readonly TrackerSealedNodeOptions[]
) {
	if (!scopes.length) return undefined;
	const logIds = new Set(scopes.map(({ logId }) => logId));
	if (logIds.has('') || logIds.size !== scopes.length)
		throw new TypeError('Tracker sealed scopes require distinct journal namespaces');
	const sources = new TrackerOperationRepository(database);
	const ticks = scopes.map((scope) => {
		const store = new TrackerSealedJournal(database, scope.logId);
		const sync = new TrackerSealedSyncService({
			...scope,
			store,
			acceptOperation: scope.belongsToScope
		});
		const source = {
			opsSince: (after: number, limit: number) =>
				sources.opsSince(after, limit, { onlyNode: localNode })
		};
		return async (lifetime: AbortSignal) => {
			const signal = AbortSignal.any([lifetime, AbortSignal.timeout(15_000)]);
			const after = store.scanCursor();
			const next = await replayTrackerSealedJournal(
				source,
				{ stage: sync.stage.bind(sync), push: () => sync.push(signal) },
				after,
				scope.belongsToScope
			);
			store.advanceScan(next);
			await sync.pull(signal);
		};
	});
	return {
		sealedSync: async (signal: AbortSignal) => {
			const outcomes = await Promise.allSettled(ticks.map((tick) => tick(signal)));
			if (outcomes.some(({ status }) => status === 'rejected'))
				throw new TrackerNodeTransportError('Tracker sealed scope sync failed');
		}
	};
}
