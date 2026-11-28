// @harness-uid u_jt4imkj6dp
import { EventEmitter } from 'node:events';
import { SqliteAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import { TrackerSchemaAdapter } from '../../adapters/projects-sessions/TrackerSchemaAdapter';
import type { TrackerSchemaAdapterConfig } from '../../adapters/projects-sessions/TrackerSchemaAdapter.types';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { TrackerOperationRepository } from '../../repositories/projects-sessions/TrackerOperationRepository';
import type {
	TrackerLocalCommit,
	TrackerLocalOperation,
	TrackerOperation,
	TrackerOperationFilter,
	TrackerSequencedOperation
} from '../../repositories/projects-sessions/TrackerOperationRepository.types';

/** Shared SQLite-backed journal used by the item API, hub and spoke links. */
export class TrackerPersistenceService {
	readonly dbId: string;
	readonly createdAt: number;
	readonly now: () => number;
	private readonly schema: TrackerSchemaAdapter;
	private readonly journal: TrackerOperationRepository;
	private readonly storage: SqliteAdapter;
	private readonly changes = new EventEmitter();

	constructor(
		readonly database: SqliteDatabase,
		readonly node: string,
		options: TrackerSchemaAdapterConfig = {}
	) {
		if (!node || /\s/.test(node)) throw new TypeError('Tracker node name is required');
		this.now = options.now ?? Date.now;
		this.schema = new TrackerSchemaAdapter(database, options);
		this.journal = new TrackerOperationRepository(database, this.now);
		this.storage = new SqliteAdapter(database, []);
		const identity = this.schema.initialize();
		this.dbId = identity.dbId;
		this.createdAt = identity.createdAt;
	}

	getMeta(key: string): string | null {
		return this.schema.getMeta(key);
	}

	writeMeta(entries: Readonly<Record<string, string>>): void {
		this.storage.transaction(() => {
			for (const [key, value] of Object.entries(entries)) this.schema.setMeta(key, value);
		});
	}

	maxSeq(): number {
		return this.journal.maxSeq();
	}

	opsSince(
		seq: number,
		limit: number,
		filter?: TrackerOperationFilter
	): TrackerSequencedOperation[] {
		return this.journal.opsSince(seq, limit, filter);
	}

	countLocalOpsSince(seq: number): number {
		return this.countOpsSince(seq, this.node);
	}

	countOpsSince(seq: number, node?: string): number {
		return this.journal.countOpsSince(seq, node);
	}

	applyOps(operations: readonly TrackerOperation[]): number {
		const { operations: applied } = this.journal.applyOps(operations);
		if (applied.length) this.changes.emit('change');
		return applied.length;
	}

	appendLocal(
		request: Omit<TrackerLocalOperation, 'node'>,
		persist?: () => void
	): TrackerOperation {
		const operation = this.journal.appendLocal({ ...request, node: this.node }, persist);
		this.changes.emit('change');
		return operation;
	}

	/** Publish a journal wake only after all writes in a synchronous decision have committed. */
	commitLocal<T>(decide: () => TrackerLocalCommit<T>): T {
		const { result, changed } = this.journal.commitLocal(this.node, decide);
		if (changed) this.changes.emit('change');
		return result;
	}

	subscribe(listener: () => void): () => void {
		this.changes.on('change', listener);
		return () => {
			this.changes.off('change', listener);
		};
	}
}
