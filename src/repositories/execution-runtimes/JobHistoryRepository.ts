// @harness-uid u_tjf4wq5l2c
import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { JobStart, JobEnd, JobKey, JobRecord } from './JobHistoryRepository.types';
import { jobRecord, jobKey } from './job-history/jobValidation';

/** Durable attempts shared by worktrees; WAL serializes concurrent writers. */
export class JobHistoryRepository {
	readonly home: string;
	private readonly db: SqliteDatabase;
	constructor(
		home: string = process.env.HARNESS_JOBS_HOME ?? join(homedir(), '.codex', 'harness', 'jobs')
	) {
		this.home = home;
		mkdirSync(home, { recursive: true, mode: 0o700 });
		const path = join(home, 'history.sqlite');
		this.db = openSqlite(path);
		chmodSync(path, 0o600);
		this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
		this.db.exec(
			'CREATE TABLE IF NOT EXISTS job_history (key TEXT PRIMARY KEY, data TEXT NOT NULL)'
		);
	}
	start(input: JobStart): JobRecord {
		const record = jobRecord(input);
		this.db
			.prepare('INSERT OR IGNORE INTO job_history VALUES (?, ?)')
			.run(jobKey(record), JSON.stringify(record));
		return this.find(record)!;
	}
	end(input: JobEnd): JobRecord {
		this.db.exec('BEGIN IMMEDIATE');
		try {
			const previous = this.find(input);
			if (!previous) throw new RangeError('Job start was not recorded');
			const record =
				previous.endedAt === undefined
					? jobRecord({
							...previous,
							endedAt: input.endedAt,
							outcome: input.outcome,
							durationMs: input.endedAt - previous.startedAt
						})
					: previous;
			this.db
				.prepare('UPDATE job_history SET data=? WHERE key=?')
				.run(JSON.stringify(record), jobKey(input));
			this.db.exec('COMMIT');
			return record;
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}
	import(input: JobRecord): boolean {
		const record = jobRecord(input);
		if (record.endedAt === undefined)
			throw new RangeError('Imported jobs require completion timing');
		return (
			Number(
				this.db
					.prepare(
						`INSERT INTO job_history VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE json_extract(job_history.data, '$.timingSource')='file-mtime-minus-duration' AND json_extract(job_history.data, '$.type')='reverify' AND json_extract(excluded.data, '$.timingSource')='file-mtime-minus-attempt-durations' AND json_extract(excluded.data, '$.type')='reverify' AND json_extract(excluded.data, '$.source') LIKE 'backfill:%'`
					)
					.run(jobKey(record), JSON.stringify(record)).changes
			) === 1
		);
	}
	all(): JobRecord[] {
		return (
			this.db.prepare('SELECT data FROM job_history ORDER BY rowid').all() as { data: string }[]
		).map((row) => JSON.parse(row.data));
	}
	close(): void {
		this.db.close();
	}
	private find(key: JobKey): JobRecord | undefined {
		const row = this.db.prepare('SELECT data FROM job_history WHERE key=?').get(jobKey(key)) as
			| { data: string }
			| undefined;
		return row ? JSON.parse(row.data) : undefined;
	}
}
