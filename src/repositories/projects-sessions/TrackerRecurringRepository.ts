// @harness-uid u_7ryrqak22k
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
import type {
	TrackerCurrentOccurrence,
	TrackerOccurrenceRow,
	TrackerRecurringItem,
	TrackerRecurringJob,
	TrackerRecurringPlan,
	TrackerRecurringSettlement,
	TrackerRecurringWork
} from './TrackerRecurringRepository.types';
import {
	readRecurringResult,
	syncRecurringResult,
	trackerRecurringSchema,
	writeOccurrence
} from './tracker-recurring-repository/recurringHistory';
import { trackerBoxJobStore } from './tracker-recurring-repository/boxJobs';

const workPrefix = 'harness_recurring_work:';
/** Repeating reminders are armed by `tracker done`; only repeating jobs are scheduled here. */
const active =
	"deleted = 0 AND title IS NOT NULL AND every IS NOT NULL AND coalesce(kind, '') <> 'reminder' AND status NOT IN ('done','ignored')";

/** Shares legacy occurrence history and commits its native job or wake intent with the item journal. */
export class TrackerRecurringRepository {
	readonly boxJobs: ReturnType<typeof trackerBoxJobStore>;

	constructor(private readonly store: TrackerPersistenceService) {
		store.database.exec(trackerRecurringSchema);
		this.boxJobs = trackerBoxJobStore(store.database);
	}

	activeItemIds(): string[] {
		const rows = this.store.database
			.prepare(`SELECT id FROM items WHERE ${active} ORDER BY id`)
			.all() as { id: string }[];
		return rows.map(({ id }) => id);
	}

	advance(
		id: string,
		now: number,
		plan: (item: TrackerRecurringItem, spec?: string) => TrackerRecurringPlan | undefined
	) {
		this.store.commitLocal(() => {
			const db = this.store.database;
			const item = db.prepare(`SELECT * FROM items WHERE id = ? AND ${active}`).get(id) as
				| TrackerRecurringItem
				| undefined;
			if (!item) return { result: undefined };
			const result = readRecurringResult(item.last_result);
			if (result) syncRecurringResult(db, id, result);
			const state = db.prepare('SELECT spec FROM recurring_state WHERE item_id = ?').get(id) as
				| { spec: string }
				| undefined;
			const next = plan(item, state?.spec);
			if (!next) return { result: undefined };
			db.prepare(
				`INSERT INTO recurring_state (item_id, spec) VALUES (?, ?)
				ON CONFLICT(item_id) DO UPDATE SET spec = excluded.spec WHERE spec <> excluded.spec`
			).run(id, next.spec);
			if (next.wake) stageWork(this.store, next.wake, now, next.missed ?? []);
			return {
				result: undefined,
				operation: Object.keys(next.fields).length ? { itemId: id, fields: next.fields } : undefined
			};
		});
	}

	work(): TrackerRecurringWork[] {
		return recurringWork(this.store);
	}

	claim(work: TrackerRecurringWork): boolean {
		if (work.phase !== 'queued') return false;
		return this.store.commitLocal(() => {
			const key = workPrefix + work.wake.key;
			if (this.store.getMeta(key) !== JSON.stringify(work)) return { result: false };
			const current = readJob(this.store, work.wake.itemId);
			const item = this.store.database
				.prepare(`SELECT 1 FROM items WHERE id = ? AND ${active} AND occurrence = ?`)
				.get(work.wake.itemId, new Date(work.wake.at).toISOString());
			if (!item || current?.updated_at !== work.job.updated_at) {
				this.store.database.prepare('DELETE FROM meta WHERE k = ?').run(key);
				return { result: false };
			}
			this.store.writeMeta({ [key]: JSON.stringify({ ...work, phase: 'claimed' }) });
			return { result: true };
		});
	}

	settle(work: TrackerRecurringWork, outcome?: TrackerRecurringSettlement): boolean {
		return this.store.commitLocal(() => {
			const key = workPrefix + work.wake.key;
			const db = this.store.database;
			if (this.store.getMeta(key) !== JSON.stringify(work)) return { result: false };
			const id = work.wake.itemId;
			const item = db
				.prepare('SELECT status, occurrence, last_result FROM items WHERE id = ? AND deleted = 0')
				.get(id) as TrackerCurrentOccurrence | undefined;
			const nextWake = item ? outcome?.wake : undefined;
			if (nextWake) this.store.writeMeta({ [key]: JSON.stringify(nextWake) });
			else db.prepare('DELETE FROM meta WHERE k = ?').run(key);
			const result = Boolean(nextWake);
			const operation = settlementOperation(db, id, item, outcome);
			return { result, operation };
		});
	}

	history(id: string, limit = 50): TrackerOccurrenceRow[] {
		const rows = this.store.database
			.prepare(
				`SELECT occurrence, status, fired_at, result_at, note, by
			FROM occurrences WHERE item_id = ? ORDER BY occurrence DESC LIMIT ?`
			)
			.all(id, limit) as (Omit<TrackerOccurrenceRow, 'fired_at'> & { fired_at: number | null })[];
		return rows.map((row) => ({
			...row,
			fired_at: row.fired_at === null ? null : new Date(row.fired_at).toISOString()
		}));
	}

	jobStatus() {
		const { n } = this.store.database.prepare('SELECT count(*) AS n FROM box_jobs').get() as {
			n: number;
		};
		const work = this.work();
		return {
			jobs: n,
			running: work.filter(({ phase }) => phase === 'claimed').map(({ wake }) => wake.itemId),
			queued: work.filter(({ phase }) => phase === 'queued').length
		};
	}

	assertLegacyRollbackSafe(): void {
		assertLegacyRecurringRollbackSafe(this.store.database);
	}
}

function settlementOperation(
	db: TrackerPersistenceService['database'],
	id: string,
	item: TrackerCurrentOccurrence | undefined,
	outcome: TrackerRecurringSettlement | undefined
) {
	if (!outcome || item?.occurrence !== outcome.result.occurrence) return undefined;
	if (readRecurringResult(item.last_result)?.occurrence === item.occurrence) return undefined;
	syncRecurringResult(db, id, outcome.result);
	const reopen = item.status === 'in_progress' || item.status === 'done';
	const fields = {
		last_result: JSON.stringify(outcome.result),
		'note+': outcome.note,
		...(reopen && { status: 'open' })
	};
	return { itemId: id, fields };
}

function recurringWork(store: TrackerPersistenceService): TrackerRecurringWork[] {
	const rows = store.database
		.prepare('SELECT v FROM meta WHERE k GLOB ? ORDER BY k')
		.all(workPrefix + '*') as { v: string }[];
	return rows.map(({ v }) => JSON.parse(v) as TrackerRecurringWork);
}

function readJob(store: TrackerPersistenceService, id: string): TrackerRecurringJob | undefined {
	return store.database
		.prepare('SELECT item_id, wake_on, timeout_s, updated_at FROM box_jobs WHERE item_id = ?')
		.get(id) as TrackerRecurringJob | undefined;
}

function stageWork(
	store: TrackerPersistenceService,
	wake: TrackerRecurringWork['wake'],
	now: number,
	missed: readonly string[]
) {
	const db = store.database;
	const { itemId, at, key } = wake;
	for (const time of missed) writeOccurrence(db, itemId, time, null);
	writeOccurrence(db, itemId, new Date(at).toISOString(), now);
	const job = readJob(store, itemId);
	if (
		job &&
		recurringWork(store).some((entry) => entry.phase !== 'wake' && entry.wake.itemId === itemId)
	)
		return;
	const work: TrackerRecurringWork = job ? { phase: 'queued', wake, job } : { phase: 'wake', wake };
	store.writeMeta({ [workPrefix + key]: JSON.stringify(work) });
}

export function assertLegacyRecurringRollbackSafe(
	database: TrackerPersistenceService['database']
): void {
	if (database.prepare('SELECT 1 FROM meta WHERE k GLOB ? LIMIT 1').get(workPrefix + '*'))
		throw new DOMException('Tracker rollback blocked by recurring work', 'InvalidStateError');
}
