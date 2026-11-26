import { DatabaseSync } from 'node:sqlite';
import recorded from './needsYouSnapshot.json' with { type: 'json' };
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import type { SnapshotMoment } from './needsYouSnapshotTracker.types';
export type { SnapshotMoment } from './needsYouSnapshotTracker.types';

export const recordedAt = Date.UTC(2026, 10, 25, 23, 30);

/** The recorded real Tracker rows loaded into a real Tracker store behind its real local API. */
export function snapshotTracker(moment: SnapshotMoment) {
	const database = new DatabaseSync(':memory:');
	const now = () => recordedAt;
	const store = new TrackerPersistenceService(database, 'fixture-hub', { now });
	for (const row of recorded.items) {
		const { id, flagged_before_cleanup, options, ...fields } = row as typeof row & {
			options?: object[];
			confirm?: string;
		};
		const flagged = moment === 'recorded' ? fields.needs_daniel : flagged_before_cleanup;
		store.appendLocal({
			itemId: id,
			fields: {
				...fields,
				needs_daniel: flagged ? 1 : 0,
				resolved: fields.resolved ? 1 : 0,
				// Real rows leave the column empty unless the item is sensitive.
				sensitive: fields.sensitive ? 1 : null,
				deleted: fields.deleted ? 1 : 0,
				...(options && { options: JSON.stringify(options) }),
				created_at: fields.updated_at
			}
		});
	}
	const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	const fetcher = (async (input: string | URL, init?: RequestInit) => {
		// The in-memory API has no machine list; the overview only needs it to be an empty list.
		if (String(input).endsWith('/machines')) return Response.json([]);
		return api.handle(new Request(String(input), init));
	}) as typeof fetch;
	return { database, store, api, fetcher, close: () => database.close() };
}
