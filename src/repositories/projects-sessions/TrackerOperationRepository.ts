// @harness-uid u_c5mwmd6z6z
import { trackerItemFields } from '../../adapters/projects-sessions/TrackerSchemaAdapter';
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import { trackerClockMilliseconds } from '../../utils/projects-sessions/nextTrackerClock';
import type {
	TrackerAppliedOperations,
	TrackerLocalCommit,
	TrackerLocalOperation,
	TrackerOperation,
	TrackerOperationFilter,
	TrackerSequencedOperation,
	TrackerStoredOperation
} from './TrackerOperationRepository.types';

import {
	localTrackerOperation,
	operationActor
} from './tracker-operation-repository/localTrackerOperation';

import { chiefReviewFields } from './tracker-operation-repository/chiefReviewFields';

const itemFields = new Set<string>(trackerItemFields);
const appendNoteField = 'note+';

export class TrackerOperationRepository {
	constructor(
		private readonly database: SqliteDatabase,
		private readonly now: () => number = Date.now,
		private readonly chiefReview = false
	) {}

	/** Apply a batch to a database with the Tracker items, item_notes and ops tables. */
	applyOps(
		operations: readonly TrackerOperation[],
		persist?: () => void
	): TrackerAppliedOperations {
		return trackerWrite(this.database, () => {
			const applied = operations.map((operation) => this.prepare(operation)).filter((operation) => this.applyOperation(operation));
			persistReceipt(persist);
			return { operations: applied, itemIds: [...new Set(applied.map(({ item_id }) => item_id))] };
		});
	}

	appendLocal(request: TrackerLocalOperation, persist?: () => void): TrackerOperation {
		return trackerWrite(this.database, () => {
			const operation = this.prepare(localTrackerOperation(this.database, request, this.now()));
			if (!this.applyOperation(operation)) throw new TypeError('Tracker operation clock collision');
			persistReceipt(persist);
			return operation;
		});
	}

	/** Decide, persist associated rows and append the optional item change under one writer lock. */
	commitLocal<T>(node: string, decide: () => TrackerLocalCommit<T>) {
		return trackerWrite(this.database, () => {
			const { result, operation } = decide();
			if (operation) {
				const next = this.prepare(localTrackerOperation(this.database, { ...operation, node }, this.now()));
				if (!this.applyOperation(next)) throw new TypeError('Tracker operation clock collision');
			}
			return { result, changed: Boolean(operation) };
		});
	}

	maxSeq(): number {
		const row = this.database.prepare('SELECT coalesce(max(seq), 0) AS seq FROM ops').get() as {
			seq: number;
		};
		return row.seq;
	}

	opsSince(
		seq: number,
		limit = 1000,
		filter: TrackerOperationFilter = {}
	): TrackerSequencedOperation[] {
		const { onlyNode } = filter;
		const select = 'SELECT seq, op_id, item_id, fields, hlc, node, actor FROM ops WHERE seq > ?';
		const rows = (
			onlyNode
				? this.database
						.prepare(select + ' AND node = ? ORDER BY seq LIMIT ?')
						.all(seq, onlyNode, limit)
				: this.database.prepare(select + ' ORDER BY seq LIMIT ?').all(seq, limit)
		) as TrackerStoredOperation[];
		return rows.map((row) => ({
			seq: row.seq,
			op_id: row.op_id,
			item_id: row.item_id,
			fields: JSON.parse(row.fields) as TrackerOperation['fields'],
			hlc: row.hlc,
			node: row.node,
			...(row.actor ? { actor: row.actor } : {})
		}));
	}

	countOpsSince(seq: number, onlyNode?: string): number {
		const select = 'SELECT count(*) AS count FROM ops WHERE seq > ?';
		const row = (
			onlyNode
				? this.database.prepare(select + ' AND node = ?').get(seq, onlyNode)
				: this.database.prepare(select).get(seq)
		) as { count: number };
		return row.count;
	}

	private prepare(operation: TrackerOperation): TrackerOperation {
		return this.chiefReview ? { ...operation, fields: chiefReviewFields(operation) } : operation;
	}

	private applyOperation(operation: TrackerOperation): boolean {
		assertOperation(operation);
		// A conflicting INSERT can advance SQLite's AUTOINCREMENT cursor.
		if (this.database.prepare('SELECT 1 FROM ops WHERE op_id = ?').get(operation.op_id))
			return false;
		this.database
			.prepare(
				`
				INSERT INTO ops(op_id, item_id, fields, hlc, node, received_at, actor)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`
			)
			.run(
				operation.op_id,
				operation.item_id,
				JSON.stringify(operation.fields),
				operation.hlc,
				String(operation.node),
				this.now(),
				operationActor(operation.actor)
			);
		applyItemFields(this.database, operation);
		return true;
	}
}

function applyItemFields(database: SqliteDatabase, operation: TrackerOperation): void {
	const { item_id: item, hlc, fields } = operation;
	database.prepare('INSERT INTO items(id) VALUES (?) ON CONFLICT(id) DO NOTHING').run(item);
	const row = database.prepare('SELECT clocks FROM items WHERE id = ?').get(item) as {
		clocks: string;
	};
	const clocks = JSON.parse(row.clocks) as Record<string, string>;
	const columns: string[] = [];
	const values: SqliteValue[] = [];
	for (const [field, value] of Object.entries(fields)) {
		if (field === appendNoteField) {
			appendTrackerNote(database, operation, value);
			if (!clocks.notes_log || hlc > clocks.notes_log) clocks.notes_log = hlc;
		} else if (itemFields.has(field) && (!clocks[field] || hlc > clocks[field])) {
			clocks[field] = hlc;
			columns.push(`${field} = ?`);
			values.push(itemValue(value));
		}
	}
	columns.push('clocks = ?', 'updated_at = ?');
	database
		.prepare(`UPDATE items SET ${columns.join(', ')} WHERE id = ?`)
		.run(...values, JSON.stringify(clocks), itemUpdatedAt(clocks), item);
}

function appendTrackerNote(
	database: SqliteDatabase,
	operation: TrackerOperation,
	value: unknown
): void {
	database
		.prepare('INSERT OR IGNORE INTO item_notes(item_id, hlc, node, text) VALUES (?, ?, ?, ?)')
		.run(operation.item_id, operation.hlc, String(operation.node), String(value));
}

function assertOperation(operation: TrackerOperation): void {
	if (
		!operation ||
		typeof operation.op_id !== 'string' ||
		typeof operation.item_id !== 'string' ||
		typeof operation.hlc !== 'string'
	)
		throw new TypeError('malformed op');
	if (!operation.fields || typeof operation.fields !== 'object')
		throw new TypeError('malformed op fields');
}

function itemUpdatedAt(clocks: Readonly<Record<string, string>>): string {
	const latest = Object.values(clocks).sort().at(-1) ?? '';
	return new Date(trackerClockMilliseconds(latest)).toISOString();
}

function itemValue(value: unknown): SqliteValue {
	if (value == null) return null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
		return value;
	if (value instanceof Uint8Array) return value;
	throw new TypeError('Tracker item fields must be SQLite scalars');
}

function persistReceipt(persist: (() => void) | undefined): void {
	if (!persist) return;
	if (Object.prototype.toString.call(persist) === '[object AsyncFunction]')
		throw new TypeError('Tracker operation receipts must be synchronous');
	const result = persist() as unknown;
	if (result && typeof (result as { then?: unknown }).then === 'function')
		throw new TypeError('Tracker operation receipts must be synchronous');
}

function trackerWrite<T>(database: SqliteDatabase, write: () => T): T {
	database.exec('BEGIN IMMEDIATE');
	try {
		const result = write();
		database.exec('COMMIT');
		return result;
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}

export type {
	TrackerAppliedOperations,
	TrackerLocalOperation,
	TrackerOperation,
	TrackerOperationFilter,
	TrackerSequencedOperation
} from './TrackerOperationRepository.types';
