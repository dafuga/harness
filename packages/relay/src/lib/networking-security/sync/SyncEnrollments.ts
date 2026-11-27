// @harness-uid u_ex57mq5k4r
import type {
	EnrollmentAuthor,
	EnrollRow,
	EnrollStep,
	EnrollmentDisplay,
	EnrollmentDecision,
	EnrollmentView
} from './SyncEnrollments.types';
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
		const columns = sql.exec<{ name: string }>('PRAGMA table_info(enrollments)').toArray();
		if (!columns.some(({ name }) => name === 'display'))
			sql.exec('ALTER TABLE enrollments ADD COLUMN display TEXT');
		if (!columns.some(({ name }) => name === 'decision'))
			sql.exec('ALTER TABLE enrollments ADD COLUMN decision TEXT');
		if (!columns.some(({ name }) => name === 'owner'))
			sql.exec('ALTER TABLE enrollments ADD COLUMN owner TEXT');
	}

	/** Null when too many requests are already waiting. */
	open(author: EnrollmentAuthor, body: string, now: number, display?: EnrollmentDisplay) {
		const { device: by, owner } = author;
		const pending = this.unexpired(now);
		const existing = pending.find(
			(view) => view.owner === owner && view.steps[0].by === by && view.steps[0].body === body
		);
		if (existing) return { view: existing, created: false };
		if (pending.filter(isPending).length >= syncLimits.openEnrollments) return null;
		const id = randomId();
		const steps = [{ n: 0, by, body }];
		this.sql.exec(
			'INSERT INTO enrollments (id, created_at, steps, display, owner) VALUES (?, ?, ?, ?, ?)',
			id,
			now,
			JSON.stringify(steps),
			display ? JSON.stringify(display) : null,
			owner ?? null
		);
		return { view: { id, createdAt: now, steps, display, owner }, created: true };
	}

	read(id: string, now: number): EnrollmentView | null {
		const row = this.sql
			.exec<EnrollRow>(
				'SELECT id, created_at, steps, display, decision, owner FROM enrollments WHERE id = ?',
				id
			)
			.toArray()[0];
		if (!row || row.created_at < now - syncLimits.enrollmentMs) return null;
		return readView(row);
	}

	pending(now: number): EnrollmentView[] {
		return this.unexpired(now).filter(isPending);
	}

	private unexpired(now: number): EnrollmentView[] {
		this.expire(now);
		const rows = this.sql
			.exec<EnrollRow>(
				'SELECT id, created_at, steps, display, decision, owner FROM enrollments ORDER BY created_at'
			)
			.toArray();
		return rows.map(readView);
	}

	/** The account object serializes denial and publication reservation without an await. */
	decide(id: string, by: string, choice: EnrollmentDecision, now: number): boolean | null {
		const view = this.read(id, now);
		if (!view || by === view.steps[0].by) return null;
		if (choice.kind === 'publish' && !matchesPublication(view, by, choice)) return null;
		const next = choice.kind === 'deny' ? 'denied' : choice.hash;
		if (view.decision) return view.decision === next ? false : null;
		if (!isPending(view)) return null;
		this.sql.exec('UPDATE enrollments SET decision = ? WHERE id = ?', next, id);
		return true;
	}

	/** Only the first claim wins. Replaying an accepted step returns its original position. */
	append(id: string, author: EnrollmentAuthor, body: string, now: number) {
		const by = author.device;
		const view = this.read(id, now);
		if (!view || view.decision === 'denied') return null;
		const fields = JSON.parse(body);
		if ('entryHash' in fields && view.decision && view.decision !== fields.entryHash) return null;
		const n = 'approver' in fields ? 1 : 'entryHash' in fields ? 3 : 2;
		if (n > view.steps.length || !expectedWriter(view, n, author)) return null;
		const existing = view.steps[n];
		if (existing) {
			if (existing.by !== by || !sameStep(existing.body, fields)) return null;
			return { step: existing, created: false };
		}
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

function readView(row: EnrollRow): EnrollmentView {
	return {
		id: row.id,
		createdAt: row.created_at,
		steps: JSON.parse(row.steps) as EnrollStep[],
		display: row.display ? (JSON.parse(row.display) as EnrollmentDisplay) : undefined,
		decision: row.decision ?? undefined,
		owner: row.owner ?? undefined
	};
}

function matchesPublication(
	view: EnrollmentView,
	by: string,
	choice: Extract<EnrollmentDecision, { kind: 'publish' }>
): boolean {
	const [opening, claim, reveal] = view.steps;
	if (!reveal || claim.by !== by || opening.by !== choice.recipient) return false;
	const keys = JSON.parse(opening.body);
	return keys.kemPublic === choice.kemPublic && keys.signingPublic === choice.signingPublic;
}

function expectedWriter(view: EnrollmentView, n: number, author: EnrollmentAuthor): boolean {
	const requester = view.steps[0].by;
	if (n === 1) return author.device !== requester;
	if (n === 2) return author.device === requester && (!view.owner || author.owner === view.owner);
	return author.device === view.steps[1].by;
}

function isPending(view: EnrollmentView): boolean {
	return !view.decision && view.steps.length < 4;
}

function sameStep(previous: string, fields: Record<string, string>): boolean {
	const saved = JSON.parse(previous);
	return (
		Object.keys(saved).length === Object.keys(fields).length &&
		Object.entries(fields).every(([key, value]) => saved[key] === value)
	);
}
