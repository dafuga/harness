// @harness-uid u_sbz3zzk4fx
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CandidateTree, CheckPlan, CheckRequest, CheckResult } from './sharedCheck.types';

const priority = { urgent: 0, normal: 1, low: 2 };

/** The queue is durable. A separate SQLite lock elects one worker without blocking submissions. */
export class CheckQueue {
	private readonly db: Database;

	constructor(readonly home: string) {
		mkdirSync(home, { recursive: true, mode: 0o700 });
		this.db = new Database(join(home, 'queue.sqlite'));
		this.db.exec('PRAGMA busy_timeout=5000');
		this.db.exec(`CREATE TABLE IF NOT EXISTS requests (
			id TEXT PRIMARY KEY, priority INTEGER NOT NULL, request TEXT NOT NULL,
			result TEXT, notified INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS requests_waiting ON requests(priority) WHERE result IS NULL;
		CREATE TABLE IF NOT EXISTS cache (
			tree TEXT NOT NULL, check_id TEXT NOT NULL, PRIMARY KEY(tree, check_id)
		);
		CREATE TABLE IF NOT EXISTS plans (
			tree TEXT NOT NULL, base TEXT NOT NULL, version INTEGER NOT NULL, plan TEXT NOT NULL,
			PRIMARY KEY(tree, base, version)
		)`);
	}

	add(request: CheckRequest): void {
		this.db
			.query('INSERT INTO requests (id, priority, request) VALUES (?, ?, ?)')
			.run(request.id, priority[request.priority], JSON.stringify(request));
	}

	pending(): CheckRequest[] {
		const rows = this.db
			.query<
				{ request: string },
				[]
			>('SELECT request FROM requests WHERE result IS NULL ORDER BY priority, rowid')
			.all();
		return rows.map((row) => JSON.parse(row.request));
	}

	finish(results: ReadonlyMap<string, CheckResult>): void {
		const persist = this.db.query('UPDATE requests SET result = ? WHERE id = ?');
		this.db.transaction(() => {
			for (const [id, result] of results) persist.run(JSON.stringify(result), id);
		})();
	}

	result(id: string): CheckResult | undefined {
		const row = this.db
			.query<{ result: string | null }, [string]>('SELECT result FROM requests WHERE id = ?')
			.get(id);
		return row?.result ? JSON.parse(row.result) : undefined;
	}

	unreported(): Array<{ request: CheckRequest; result: CheckResult }> {
		return this.db
			.query<{ request: string; result: string }, []>(
				'SELECT request, result FROM requests WHERE result IS NOT NULL AND notified = 0'
			)
			.all()
			.map(({ request, result }) => ({ request: JSON.parse(request), result: JSON.parse(result) }));
	}

	reported(id: string): void {
		this.db.query('UPDATE requests SET notified = 1 WHERE id = ?').run(id);
	}

	cached(tree: string, check: string): boolean {
		return (
			this.db.query('SELECT 1 FROM cache WHERE tree = ? AND check_id = ?').get(tree, check) !== null
		);
	}

	cache(tree: string, check: string): void {
		this.db.query('INSERT OR IGNORE INTO cache VALUES (?, ?)').run(tree, check);
	}

	plan(candidate: CandidateTree): CheckPlan | undefined {
		const row = this.db
			.query<
				{ plan: string },
				[string, string]
			>('SELECT plan FROM plans WHERE tree = ? AND base = ? AND version = 1')
			.get(candidate.tree, candidate.base);
		return row ? JSON.parse(row.plan) : undefined;
	}

	storePlan(candidate: CandidateTree, plan: CheckPlan): void {
		this.db
			.query('INSERT OR REPLACE INTO plans VALUES (?, ?, 1, ?)')
			.run(candidate.tree, candidate.base, JSON.stringify(plan));
	}

	async work(action: () => Promise<void>): Promise<boolean> {
		const latch = new Database(join(this.home, 'worker.sqlite'));
		try {
			latch.exec('PRAGMA busy_timeout=0');
			try {
				latch.exec('BEGIN IMMEDIATE');
			} catch (error) {
				if (error instanceof Error && 'code' in error && error.code === 'SQLITE_BUSY') return false;
				throw error;
			}
			await action();
			return true;
		} finally {
			latch.close();
		}
	}

	close(): void {
		this.db.close();
	}
}
