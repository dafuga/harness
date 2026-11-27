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
	open(by: string, body: string, now: number) {
		const pending = this.unexpired(now);
		const existing = pending.find(({ steps }) => steps[0].by === by && steps[0].body === body);
		if (existing) return { view: existing, created: false };
		if (pending.filter(isPending).length >= syncLimits.openEnrollments) return null;
		const id = randomId();
		const steps = [{ n: 0, by, body }];
		this.sql.exec(
			'INSERT INTO enrollments (id, created_at, steps) VALUES (?, ?, ?)',
			id,
			now,
			JSON.stringify(steps)
		);
		return { view: { id, createdAt: now, steps }, created: true };
	}

	read(id: string, now: number): EnrollmentView | null {
		const row = this.sql
			.exec<EnrollRow>('SELECT id, created_at, steps FROM enrollments WHERE id = ?', id)
			.toArray()[0];
		if (!row || row.created_at < now - syncLimits.enrollmentMs) return null;
		return { id: row.id, createdAt: row.created_at, steps: JSON.parse(row.steps) as EnrollStep[] };
	}

	pending(now: number): EnrollmentView[] {
		return this.unexpired(now).filter(isPending);
	}

	private unexpired(now: number): EnrollmentView[] {
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

	/** Only the first claim wins. Replaying an accepted step returns its original position. */
	append(id: string, by: string, body: string, now: number) {
		const view = this.read(id, now);
		if (!view) return null;
		const fields = JSON.parse(body);
		const n = 'approver' in fields ? 1 : 'entryHash' in fields ? 3 : 2;
		const existing = view.steps[n];
		if (existing) {
			if (existing.by !== by || !sameStep(existing.body, fields)) return null;
			return { step: existing, created: false };
		}
		if (view.steps.length !== n) return null;
		const requester = view.steps[0].by;
		if (n === 1 && by === requester) return null;
		if (n === 2 && by !== requester) return null;
		if (n === 3 && by !== view.steps[1].by) return null;
		const step = { n, by, body };
		this.sql.exec(
			'UPDATE enrollments SET steps = ? WHERE id = ?',
			JSON.stringify([...view.steps, step]),
			id
		);
		return { step, created: true };
	}

	expire(now: number): void {
		this.sql.exec('DELETE FROM enrollments WHERE created_at < ?', now - syncLimits.enrollmentMs);
	}

	/** True while any request is still waiting; the object keeps an alarm until none is. */
	any(): boolean {
		return this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM enrollments').one().c > 0;
	}
}

function isPending(view: EnrollmentView): boolean {
	return view.steps.length < 4;
}

function sameStep(previous: string, fields: Record<string, string>): boolean {
	const saved = JSON.parse(previous);
	return (
		Object.keys(saved).length === Object.keys(fields).length &&
		Object.entries(fields).every(([key, value]) => saved[key] === value)
	);
}
