// @harness-uid u_eug7dfr5kp
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerAdapterCandidate,
	TrackerAdapterItem,
	TrackerAdapterLink,
	TrackerAdapterRemoteState
} from './TrackerAdapterRepository.types';

/** Tracker links and receipts, on the same connection as the item journal. */
export class TrackerAdapterRepository {
	constructor(private readonly database: SqliteDatabase) {}

	link(sourceId: string, externalId: string): TrackerAdapterLink | undefined {
		return this.database
			.prepare('SELECT * FROM adapter_links WHERE source_id = ? AND external_id = ?')
			.get(sourceId, externalId) as TrackerAdapterLink | undefined;
	}

	linkByKey(sourceId: string, key: string): TrackerAdapterLink | undefined {
		return this.database
			.prepare('SELECT * FROM adapter_links WHERE source_id = ? AND external_key = ?')
			.get(sourceId, key) as TrackerAdapterLink | undefined;
	}

	saveLink(link: TrackerAdapterLink): void {
		this.database
			.prepare(
				`
			INSERT INTO adapter_links(source_id, external_id, external_key, item_id, remote_state, events_after, owned, sync_pending)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`
			)
			.run(
				link.source_id,
				link.external_id,
				link.external_key,
				link.item_id,
				link.remote_state,
				link.events_after,
				link.owned,
				link.sync_pending
			);
	}

	hasEvent(link: TrackerAdapterLink, id: string): boolean {
		return Boolean(
			this.database
				.prepare(
					'SELECT 1 FROM adapter_events WHERE source_id = ? AND external_id = ? AND event_id = ?'
				)
				.get(link.source_id, link.external_id, id)
		);
	}

	saveEvent(link: TrackerAdapterLink, id: string): void {
		this.database
			.prepare('INSERT INTO adapter_events(source_id, external_id, event_id) VALUES (?, ?, ?)')
			.run(link.source_id, link.external_id, id);
	}

	saveState(link: TrackerAdapterLink, state: TrackerAdapterRemoteState): void {
		this.database
			.prepare('UPDATE adapter_links SET remote_state = ? WHERE source_id = ? AND external_id = ?')
			.run(state, link.source_id, link.external_id);
	}

	pending(sourceId: string): TrackerAdapterLink[] {
		return this.database
			.prepare(
				'SELECT * FROM adapter_links WHERE source_id = ? AND sync_pending = 1 ORDER BY external_id'
			)
			.all(sourceId) as TrackerAdapterLink[];
	}

	acknowledgeWrite(link: TrackerAdapterLink): void {
		this.database
			.prepare('UPDATE adapter_links SET sync_pending = 0 WHERE source_id = ? AND external_id = ?')
			.run(link.source_id, link.external_id);
	}

	item(id: string): TrackerAdapterItem | undefined {
		return this.database
			.prepare('SELECT id, status, deleted, launch_source FROM items WHERE id = ?')
			.get(id) as TrackerAdapterItem | undefined;
	}

	candidates(): TrackerAdapterCandidate[] {
		return this.database
			.prepare(
				'SELECT id, title, agent, project FROM items WHERE deleted = 0 AND title IS NOT NULL ORDER BY created_at, id'
			)
			.all() as TrackerAdapterCandidate[];
	}
}
