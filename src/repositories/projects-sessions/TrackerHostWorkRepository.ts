// @harness-uid u_rhat43dtk7
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { trackerHostWork } from '../../utils/projects-sessions/trackerHostWork';
import type { TrackerHostWorkClaim } from './TrackerHostWorkRepository.types';
import type { TrackerHostWork } from '../../utils/projects-sessions/trackerHostWork.types';

/** Local, expiring claims that a live run is using another computer. */
export class TrackerHostWorkRepository {
	constructor(private readonly database: SqliteDatabase) {}

	renew(claim: TrackerHostWorkClaim, now: number): boolean {
		if (!this.available()) return false;
		const { run, lease, host, kind } = claim;
		const result = this.database
			.prepare(
				`INSERT INTO run_host_work(run_id, lease, host, kind, expires_at)
				SELECT id, ?, ?, ?, ? FROM runs
				WHERE id = ? AND state IN ('running','verifying') AND ended_at IS NULL
				ON CONFLICT(run_id, lease) DO UPDATE SET expires_at = excluded.expires_at
				WHERE run_host_work.host = excluded.host AND run_host_work.kind = excluded.kind`
			)
			.run(lease, host, kind, now + trackerHostWork.leaseMs, run);
		return Number(result.changes) === 1;
	}

	release(claim: TrackerHostWorkClaim): void {
		if (!this.available()) return;
		const { run, lease, host, kind } = claim;
		this.database
			.prepare('DELETE FROM run_host_work WHERE run_id = ? AND lease = ? AND host = ? AND kind = ?')
			.run(run, lease, host, kind);
	}

	active(now: number): TrackerHostWork[] {
		if (!this.available()) return [];
		this.database.prepare('DELETE FROM run_host_work WHERE expires_at <= ?').run(now);
		return this.database
			.prepare(
				`SELECT run_id AS run, host, max(expires_at) AS expires_at FROM run_host_work
				GROUP BY run_id, host ORDER BY run_id, host`
			)
			.all() as unknown as TrackerHostWork[];
	}

	private available(): boolean {
		return Boolean(
			this.database
				.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'run_host_work'")
				.get()
		);
	}
}
