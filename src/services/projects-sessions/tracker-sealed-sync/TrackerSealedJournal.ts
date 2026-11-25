import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { TrackerOperationRepository } from '../../../repositories/projects-sessions/TrackerOperationRepository';
import type { TrackerOperation } from '../../../repositories/projects-sessions/TrackerOperationRepository.types';
import type { OutboxEntry, TrackerSealedSyncStore } from './TrackerSealedSyncService.types';

/** Persistence for one sealed log. The log ID must identify the account, device, server and scope. */
export class TrackerSealedJournal implements TrackerSealedSyncStore {
	private readonly operations: TrackerOperationRepository;

	constructor(
		private readonly database: SqliteDatabase,
		private readonly logId: string
	) {
		this.operations = new TrackerOperationRepository(database);
		database.exec(`
			CREATE TABLE IF NOT EXISTS sealed_tracker_outbox (
				log TEXT NOT NULL, localSeq INTEGER NOT NULL, envelope TEXT,
				PRIMARY KEY (log, localSeq)
			);
			CREATE TABLE IF NOT EXISTS sealed_tracker_cursor (
				log TEXT PRIMARY KEY, cursor INTEGER NOT NULL
			);
		`);
	}

	stage({ localSeq, envelope }: OutboxEntry): void {
		this.database
			.prepare(
				'INSERT OR IGNORE INTO sealed_tracker_outbox(log, localSeq, envelope) VALUES (?, ?, ?)'
			)
			.run(this.logId, localSeq, envelope);
	}

	pending(): OutboxEntry[] {
		return this.database
			.prepare(
				'SELECT localSeq, envelope FROM sealed_tracker_outbox WHERE log = ? AND envelope IS NOT NULL ORDER BY localSeq LIMIT 64'
			)
			.all(this.logId) as OutboxEntry[];
	}

	acknowledge(entries: readonly OutboxEntry[]): void {
		this.database.exec('BEGIN IMMEDIATE');
		try {
			const update = this.database.prepare(
				'UPDATE sealed_tracker_outbox SET envelope = NULL WHERE log = ? AND localSeq = ? AND envelope = ?'
			);
			for (const entry of entries) update.run(this.logId, entry.localSeq, entry.envelope);
			this.database.exec('COMMIT');
		} catch (error) {
			this.database.exec('ROLLBACK');
			throw error;
		}
	}

	cursor(): number {
		const row = this.database
			.prepare('SELECT cursor FROM sealed_tracker_cursor WHERE log = ?')
			.get(this.logId) as { cursor: number } | undefined;
		return row?.cursor ?? 0;
	}

	apply(after: number, next: number, operations: readonly TrackerOperation[]): void {
		this.operations.applyOps(operations, () => {
			if (this.cursor() !== after) throw new Error('Tracker sealed cursor changed during pull');
			this.database
				.prepare(
					'INSERT INTO sealed_tracker_cursor(log, cursor) VALUES (?, ?) ON CONFLICT(log) DO UPDATE SET cursor = excluded.cursor'
				)
				.run(this.logId, next);
		});
	}
}
