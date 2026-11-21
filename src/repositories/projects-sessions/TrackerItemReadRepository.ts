// @harness-uid u_xba7ieg4je
import type { SqliteDatabase, SqliteStatement } from '../../core/development-tooling/sqliteTypes';
import { TrackerItemReadError } from './tracker-item-read-repository/TrackerItemReadError';
import { buildTrackerDigest } from './tracker-item-read-repository/buildTrackerDigest';
import { formatTrackerDigest } from './tracker-item-read-repository/formatTrackerDigest';
import { serializeTrackerItem } from './tracker-item-read-repository/serializeTrackerItem';
import type {
	TrackerDigest,
	TrackerItem,
	TrackerItemListFilters,
	TrackerItemRow
} from './TrackerItemReadRepository.types';

const activeStatus = "status NOT IN ('done', 'ignored')";
const visibleItems = 'deleted = 0 AND title IS NOT NULL';
const filterColumns = ['kind', 'owner', 'agent', 'parent'] as const;
const itemStatuses = new Set(['open', 'in_progress', 'blocked', 'done', 'ignored']);
const defaultTimeZone = 'Europe/Lisbon';

/** Read public Tracker items and digests from an initialized SQLite store. */
export class TrackerItemReadRepository {
	constructor(private readonly database: SqliteDatabase) {}

	/** Prefer an exact live ID, then resolve an unambiguous prefix. */
	get(idOrPrefix: string): TrackerItem {
		return serializeTrackerItem(this.resolve(idOrPrefix), this.noteQuery());
	}

	/** Return the item array used by the Tracker loopback list endpoint. */
	list(filters: TrackerItemListFilters = {}): TrackerItem[] {
		const where = [visibleItems];
		const values: string[] = [];
		if (!filters.status) where.push(activeStatus);
		else if (filters.status !== 'all') {
			where.push('status = ?');
			values.push(normalizeStatus(filters.status));
		}
		for (const column of filterColumns) {
			const value = filters[column];
			if (!value) continue;
			where.push(`${column} = ?`);
			values.push(String(value));
		}
		if (queryFlag(filters.flagged)) where.push('needs_daniel = 1 AND resolved = 0');
		if (queryFlag(filters.recurring)) where.push('every IS NOT NULL');
		const rows = this.database
			.prepare(
				`SELECT * FROM items WHERE ${where.join(' AND ')}
				 ORDER BY (due IS NULL), due, created_at LIMIT ?`
			)
			.all(...values, Number(filters.limit) || 500) as TrackerItemRow[];
		const notes = this.noteQuery();
		return rows.map((row) => serializeTrackerItem(row, notes));
	}

	/** Build the digest with an explicit clock and the store's configured time zone. */
	digest(nowMs: number, timeZone: string = defaultTimeZone): TrackerDigest {
		const rows = this.database
			.prepare(`SELECT * FROM items WHERE ${visibleItems} AND ${activeStatus}`)
			.all() as TrackerItemRow[];
		return buildTrackerDigest(rows, nowMs, timeZone);
	}

	/** Format a digest using the legacy CLI section order and summaries. */
	digestText(nowMs: number, timeZone: string = defaultTimeZone): string {
		return formatTrackerDigest(this.digest(nowMs, timeZone));
	}

	private resolve(idOrPrefix: string): TrackerItemRow {
		const id = String(idOrPrefix || '')
			.trim()
			.toLowerCase();
		if (!id) throw new TrackerItemReadError('item id required');
		const exact = this.database.prepare('SELECT * FROM items WHERE id = ?').get(id) as
			| TrackerItemRow
			| undefined;
		if (exact && !exact.deleted) return exact;
		const rows = this.database
			.prepare("SELECT * FROM items WHERE id LIKE ? || '%' AND deleted = 0 LIMIT 2")
			.all(id) as TrackerItemRow[];
		if (!rows.length) throw new TrackerItemReadError(`no item "${id}"`, 404);
		if (rows.length > 1)
			throw new TrackerItemReadError(`"${id}" is ambiguous; use more characters`);
		return rows[0];
	}

	private noteQuery(): SqliteStatement {
		return this.database.prepare(
			'SELECT hlc, node, text FROM item_notes WHERE item_id = ? ORDER BY hlc'
		);
	}
}

function normalizeStatus(value: string): string {
	const normalized = String(value)
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	const status = normalized === 'inprogress' ? 'in_progress' : normalized;
	if (!itemStatuses.has(status)) {
		throw new TrackerItemReadError('status must be open, in_progress, blocked, done or ignored');
	}
	return status;
}

function queryFlag(value: string | boolean | undefined): boolean {
	return value === true || value === '1' || value === 'true';
}

export type { TrackerDigest, TrackerItem, TrackerItemListFilters };
