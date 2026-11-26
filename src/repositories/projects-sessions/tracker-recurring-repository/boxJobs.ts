// @harness-uid u_ygbsi3wzod
// The local, unsynced `box_jobs` table: nothing typed on another computer can add a command.
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerBoxJob, TrackerListedBoxJob } from '../TrackerRecurringRepository.types';

/** The job definitions as the hub's `tracker job` commands see them. */
export function trackerBoxJobStore(db: SqliteDatabase) {
	return {
		read: (id: string) => readBoxJob(db, id),
		list: () => listBoxJobs(db),
		write: (job: Omit<TrackerBoxJob, 'created_at'>) => writeBoxJob(db, job),
		remove: (id: string) => deleteBoxJob(db, id)
	};
}

function readBoxJob(db: SqliteDatabase, id: string): TrackerBoxJob | undefined {
	return db.prepare('SELECT * FROM box_jobs WHERE item_id = ?').get(id) as
		| TrackerBoxJob
		| undefined;
}

function listBoxJobs(db: SqliteDatabase): Omit<TrackerListedBoxJob, 'running'>[] {
	return db
		.prepare(
			`SELECT j.*, i.title, i.every, i.owner FROM box_jobs j
			LEFT JOIN items i ON i.id = j.item_id ORDER BY j.created_at, j.item_id`
		)
		.all() as Omit<TrackerListedBoxJob, 'running'>[];
}

function writeBoxJob(db: SqliteDatabase, job: Omit<TrackerBoxJob, 'created_at'>) {
	const { item_id, cmd, wake_on, timeout_s, updated_at } = job;
	db.prepare(
		`INSERT INTO box_jobs (item_id, cmd, wake_on, timeout_s, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET cmd = excluded.cmd,
		wake_on = excluded.wake_on, timeout_s = excluded.timeout_s, updated_at = excluded.updated_at`
	).run(item_id, cmd, wake_on, timeout_s, updated_at, updated_at);
}

function deleteBoxJob(db: SqliteDatabase, id: string): boolean {
	return Boolean(db.prepare('DELETE FROM box_jobs WHERE item_id = ?').run(id).changes);
}
