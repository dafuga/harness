// @harness-uid u_c5mwmd6z6z
import { trackerItemFields } from '../../adapters/projects-sessions/TrackerSchemaAdapter';
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerAppliedOperations,
	TrackerOperation,
	TrackerOperationFilter,
	TrackerSequencedOperation,
	TrackerStoredOperation
} from './TrackerOperationRepository.types';

const itemFields = new Set<string>(trackerItemFields);
const appendNoteField = 'note+';
const clockPattern = /^(\d{15})-\d{6}-.+$/;

export class TrackerOperationRepository {
	constructor(
		private readonly database: SqliteDatabase,
		private readonly now = Date.now
	) {}

	/** Apply a batch to a database with the Tracker items, item_notes and ops tables. */
	applyOps(
		operations: readonly TrackerOperation[],
		persist?: () => void
	): TrackerAppliedOperations {
		this.database.exec('BEGIN IMMEDIATE');
		try {
			const applied = operations.filter((operation) => this.applyOperation(operation));
			persistReceipt(persist);
			this.database.exec('COMMIT');
			return { operations: applied, itemIds: [...new Set(applied.map(({ item_id }) => item_id))] };
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
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
		{ onlyNode }: TrackerOperationFilter = {}
	): TrackerSequencedOperation[] {
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
		this.applyItemFields(operation);
		return true;
	}

	private applyItemFields(operation: TrackerOperation): void {
		const { item_id: item, hlc, fields } = operation;
		this.database.prepare('INSERT INTO items(id) VALUES (?) ON CONFLICT(id) DO NOTHING').run(item);
		const row = this.database.prepare('SELECT clocks FROM items WHERE id = ?').get(item) as {
			clocks: string;
		};
		const clocks = JSON.parse(row.clocks) as Record<string, string>;
		const columns: string[] = [];
		const values: SqliteValue[] = [];
		for (const [field, value] of Object.entries(fields)) {
			if (field === appendNoteField) {
				this.appendNote(operation, value);
				if (!clocks.notes_log || hlc > clocks.notes_log) clocks.notes_log = hlc;
			} else if (itemFields.has(field) && (!clocks[field] || hlc > clocks[field])) {
				clocks[field] = hlc;
				columns.push(`${field} = ?`);
				values.push(itemValue(value));
			}
		}
		columns.push('clocks = ?', 'updated_at = ?');
		this.database
			.prepare(`UPDATE items SET ${columns.join(', ')} WHERE id = ?`)
			.run(...values, JSON.stringify(clocks), itemUpdatedAt(clocks), item);
	}

	private appendNote(operation: TrackerOperation, value: unknown): void {
		this.database
			.prepare('INSERT OR IGNORE INTO item_notes(item_id, hlc, node, text) VALUES (?, ?, ?, ?)')
			.run(operation.item_id, operation.hlc, String(operation.node), String(value));
	}
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

function operationActor(actor: string | null | undefined): string | null {
	if (actor == null) return null;
	// eslint-disable-next-line no-control-regex -- The Tracker actor field excludes ASCII control characters.
	const printable = String(actor).replace(/[\x00-\x1f\x7f]/g, '');
	return printable.trim().slice(0, 80) || null;
}

function itemUpdatedAt(clocks: Readonly<Record<string, string>>): string {
	const latest = Object.values(clocks).sort().at(-1) ?? '';
	const milliseconds = Number(clockPattern.exec(latest)?.[1] ?? 0);
	return new Date(milliseconds).toISOString();
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

export type {
	TrackerAppliedOperations,
	TrackerOperation,
	TrackerOperationFilter,
	TrackerSequencedOperation
} from './TrackerOperationRepository.types';
