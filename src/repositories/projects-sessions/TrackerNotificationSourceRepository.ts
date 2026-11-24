// @harness-uid u_o3bwaj4ogu
import type {
	TrackerItemCallback,
	TrackerNotificationItem,
	TrackerNotificationOp,
	TrackerNotificationSource
} from '../../services/projects-sessions/TrackerNotificationService.types';
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
import { TrackerItemReadRepository } from './TrackerItemReadRepository';
import type {
	TrackerNotificationSourceOptions,
	TrackerStoredNotificationAgent,
	TrackerStoredNotificationItem
} from './TrackerNotificationSourceRepository.types';
import { TrackerRunReadRepository } from './TrackerRunReadRepository';

/** Reads notification inputs from the same journal used by the local API and sync. */
export class TrackerNotificationSourceRepository implements TrackerNotificationSource {
	readonly node: string;
	readonly createdAt: number;
	readonly tz: string;
	private readonly itemRead: TrackerItemReadRepository;
	private readonly runRead: TrackerRunReadRepository;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly options: TrackerNotificationSourceOptions
	) {
		this.node = store.node;
		this.createdAt = store.createdAt;
		this.tz = options.timeZone;
		this.itemRead = new TrackerItemReadRepository(store.database);
		this.runRead = new TrackerRunReadRepository(store.database, store.node);
	}

	items(): TrackerNotificationItem[] {
		const rows = this.store.database
			.prepare('SELECT * FROM items WHERE title IS NOT NULL')
			.all() as TrackerStoredNotificationItem[];
		return rows.map((row) => this.notificationItem(row));
	}

	scheduledItems(through: number): TrackerNotificationItem[] {
		const rows = this.store.database
			.prepare(
				"SELECT * FROM items WHERE remind_at <= ? AND title IS NOT NULL AND deleted = 0 AND status NOT IN ('done', 'ignored')"
			)
			.all(new Date(through).toISOString()) as TrackerStoredNotificationItem[];
		return rows.map((row) => this.notificationItem(row));
	}

	item(id: string): TrackerNotificationItem | undefined {
		const row = this.raw(id);
		return row ? this.notificationItem(row) : undefined;
	}

	agent(name: string): ReturnType<TrackerNotificationSource['agent']> {
		const row = this.store.database
			.prepare('SELECT name, target, created_at FROM agents WHERE name = ?')
			.get(name) as TrackerStoredNotificationAgent | undefined;
		if (!row) return undefined;
		const target = this.options.resolveDestination(JSON.parse(row.target));
		return target
			? { name: row.name, target, createdAt: row.created_at, legacyTarget: row.target }
			: undefined;
	}

	maxSeq(): number {
		return this.store.maxSeq();
	}

	opsSince(seq: number, limit: number): TrackerNotificationOp[] {
		return this.store.opsSince(seq, limit).map((op) => ({ ...op, actor: op.actor ?? null }));
	}

	publicItem(id: string): ReturnType<TrackerItemReadRepository['getStored']> | null {
		return this.raw(id) ? this.itemRead.getStored(id) : null;
	}

	digest(now: number): ReturnType<TrackerItemReadRepository['digest']> {
		return this.itemRead.digest(now, this.tz);
	}

	latestNote(id: string): string | undefined {
		const row = this.store.database
			.prepare('SELECT text FROM item_notes WHERE item_id = ? ORDER BY hlc DESC LIMIT 1')
			.get(id) as { text: string } | undefined;
		return row?.text;
	}

	launchStarted(id: string, token: string): boolean {
		return this.runRead
			.list({ itemId: id })
			.some((run) => run.auto_token === token && run.started_at != null);
	}

	private raw(id: string): TrackerStoredNotificationItem | undefined {
		return this.store.database.prepare('SELECT * FROM items WHERE id = ?').get(id) as
			| TrackerStoredNotificationItem
			| undefined;
	}

	private notificationItem(row: TrackerStoredNotificationItem): TrackerNotificationItem {
		return { ...row, clocks: JSON.parse(row.clocks), callback: this.callback(row.callback) };
	}

	private callback(value: string | null): TrackerItemCallback | null {
		if (!value) return null;
		const stored: unknown = JSON.parse(value);
		if (!stored || typeof stored !== 'object' || !('node' in stored)) return null;
		if (typeof stored.node !== 'string') return null;
		const destination = this.options.resolveDestination(stored);
		return destination ? { node: stored.node, ...destination, legacyTarget: value } : null;
	}
}
