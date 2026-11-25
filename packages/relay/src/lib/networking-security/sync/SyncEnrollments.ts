// @harness-uid u_ex57mq5k4r
import type { EnrollRow, EnrollStep, EnrollmentView } from './SyncEnrollments.types';
import { randomId } from '../../../../../remote/src/index';
import { syncLimits } from './syncWire';

/**
 * A mailbox for device sign-in: the new device's request, the approver's claim, the reveal.
 * Short-lived and opaque; the chain and the grants, not this box, decide who is enrolled.
 */
export class SyncEnrollments {
	constructor(private readonly sql: SqlStorage) {
		sql.exec(
			`CREATE TABLE IF NOT EXISTS enrollments (
				id TEXT PRIMARY KEY,
				created_at INTEGER NOT NULL,
				steps TEXT NOT NULL
			)`
		);
	}

	/** Null when too many requests are already waiting. */
	open(by: string, body: string, now: number): EnrollmentView | null {
		this.expire(now);
		const count = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM enrollments').one().c;
		if (count >= syncLimits.openEnrollments) return null;
		const id = randomId();
		const steps = [{ n: 0, by, body }];
		this.sql.exec(
			'INSERT INTO enrollments (id, created_at, steps) VALUES (?, ?, ?)',
			id,
			now,
			JSON.stringify(steps)
		);
		return { id, createdAt: now, steps };
	}

	read(id: string, now: number): EnrollmentView | null {
		const row = this.sql
			.exec<EnrollRow>('SELECT id, created_at, steps FROM enrollments WHERE id = ?', id)
			.toArray()[0];
		if (!row || row.created_at < now - syncLimits.enrollmentMs) return null;
		return { id: row.id, createdAt: row.created_at, steps: JSON.parse(row.steps) as EnrollStep[] };
	}

	pending(now: number): EnrollmentView[] {
		this.expire(now);
		const rows = this.sql
			.exec<EnrollRow>('SELECT id, created_at, steps FROM enrollments ORDER BY created_at')
			.toArray();
		return rows.map((row) => ({
			id: row.id,
			createdAt: row.created_at,
			steps: JSON.parse(row.steps) as EnrollStep[]
		}));
	}

	/** Appends a step and returns it, or null when the request is gone or full. */
	append(id: string, by: string, body: string, now: number): EnrollStep | null {
		const view = this.read(id, now);
		if (!view || view.steps.length >= syncLimits.enrollmentSteps) return null;
		const step = { n: view.steps.length, by, body };
		this.sql.exec(
			'UPDATE enrollments SET steps = ? WHERE id = ?',
			JSON.stringify([...view.steps, step]),
			id
		);
		return step;
	}

	expire(now: number): void {
		this.sql.exec('DELETE FROM enrollments WHERE created_at < ?', now - syncLimits.enrollmentMs);
	}

	/** True while any request is still waiting; the object keeps an alarm until none is. */
	any(): boolean {
		return this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM enrollments').one().c > 0;
	}
}
