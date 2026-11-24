// @harness-uid u_xba7ieg4je
import type { SqliteDatabase, SqliteStatement } from '../../core/development-tooling/sqliteTypes';
import { TrackerRunReadRepository } from './TrackerRunReadRepository';
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

import {
	trackerPlanningStageSql,
	trackerStage
} from '../../utils/projects-sessions/trackerPlanning';

const itemChases = 'items LEFT JOIN tracker_item_chases ON chase_item_id = id';
const activeStatus = "status NOT IN ('done', 'ignored')";
const visibleItems = 'deleted = 0 AND title IS NOT NULL';
const visibleAttention = '(remind_at IS NULL OR remind_at <= ?)';
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

	/** Read a committed item, including a tombstone, without prefix matching. */
	getStored(id: string): TrackerItem {
		const row = this.raw(id);
		if (!row) throw new TrackerItemReadError(`no item "${id}"`, 404);
		return serializeTrackerItem(row, this.noteQuery());
	}

	/** Read rows needed by duplicate probing and mutation planning. */
	candidates(): TrackerItemRow[] {
		return this.database
			.prepare(
				`SELECT * FROM items WHERE ${visibleItems} AND
				 (status <> 'done' OR (next_step IS NOT NULL AND needs_daniel = 1 AND resolved = 0))`
			)
			.all() as TrackerItemRow[];
	}

	/** Return the item array used by the Tracker loopback list endpoint. */
	list(filters: TrackerItemListFilters = {}, nowMs: number = Date.now()): TrackerItem[] {
		const where = [visibleItems];
		const values: string[] = [];
		addStatusFilter(filters, where, values);
		addFieldFilters(filters, where, values);
		if (queryFlag(filters.flagged)) {
			where.push(
				'needs_daniel = 1 AND resolved = 0',
				visibleAttention,
				'(parked_until IS NULL OR parked_until <= ?)'
			);
			const now = new Date(nowMs).toISOString();
			values.push(now, now);
		}
		if (queryFlag(filters.recurring)) where.push('every IS NOT NULL');
		const rows = this.database
			.prepare(
				`SELECT * FROM ${itemChases} WHERE ${where.join(' AND ')}
				 ORDER BY (due IS NULL), due, created_at LIMIT ?`
			)
			.all(...values, Number(filters.limit) || 500) as TrackerItemRow[];
		const notes = this.noteQuery();
		return rows.map((row) => serializeTrackerItem(row, notes));
	}

	/** Build the digest with an explicit clock and the store's configured time zone. */
	digest(nowMs: number, timeZone: string = defaultTimeZone): TrackerDigest {
		const rows = this.database
			.prepare(
				`SELECT * FROM ${itemChases} WHERE ${visibleItems} AND (
					chased_count > 0 OR (${activeStatus} AND ${visibleAttention})
					OR (status <> 'ignored' AND needs_daniel = 1 AND resolved = 0)
					OR (status IN ('open','in_progress') AND auto IS NOT NULL)
				)`
			)
			.all(new Date(nowMs).toISOString()) as TrackerItemRow[];
		return buildTrackerDigest(
			rows,
			nowMs,
			timeZone,
			new TrackerRunReadRepository(this.database, '')
		);
	}

	/** Format a digest using the legacy CLI section order and summaries. */
	digestText(nowMs: number, timeZone: string = defaultTimeZone): string {
		return formatTrackerDigest(this.digest(nowMs, timeZone));
	}

	resolve(idOrPrefix: string): TrackerItemRow {
		const id = String(idOrPrefix || '')
			.trim()
			.toLowerCase();
		if (!id) throw new TrackerItemReadError('item id required');
		const exact = this.raw(id);
		if (exact && !exact.deleted) return exact;
		const rows = this.database
			.prepare(`SELECT * FROM ${itemChases} WHERE id LIKE ? || '%' AND deleted = 0 LIMIT 2`)
			.all(id) as TrackerItemRow[];
		if (!rows.length) throw new TrackerItemReadError(`no item "${id}"`, 404);
		if (rows.length > 1)
			throw new TrackerItemReadError(`"${id}" is ambiguous; use more characters`);
		return rows[0];
	}

	private raw(id: string): TrackerItemRow | undefined {
		return this.database.prepare(`SELECT * FROM ${itemChases} WHERE id = ?`).get(id) as
			| TrackerItemRow
			| undefined;
	}

	private noteQuery(): SqliteStatement {
		return this.database.prepare(
			'SELECT hlc, node, text FROM item_notes WHERE item_id = ? ORDER BY hlc'
		);
	}
}

function addStatusFilter(filters: TrackerItemListFilters, where: string[], values: string[]) {
	const { status } = filters;
	if (queryFlag(filters.chased)) where.push('chased_count > 0');
	if (!status) {
		if (queryFlag(filters.flagged)) where.push("status <> 'ignored'");
		else if (!queryFlag(filters.chased)) where.push(activeStatus);
	} else if (status !== 'all') {
		where.push('status = ?');
		values.push(normalizeStatus(status));
	}
}

function addFieldFilters(filters: TrackerItemListFilters, where: string[], values: string[]) {
	for (const column of filterColumns) {
		const value = filters[column];
		if (!value) continue;
		where.push(`${column} = ?`);
		values.push(String(value));
	}
	if (filters.stage !== undefined) {
		where.push(trackerPlanningStageSql + ' = ?');
		values.push(trackerStage(filters.stage));
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
