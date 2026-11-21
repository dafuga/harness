// @harness-uid u_46eur7qage
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerSupervisorViews } from '../TrackerSupervisorService.types';

export function trackerSupervisorStatus(
	runtime: TrackerNativeRuntimeService,
	startedAt: string,
	views?: Partial<TrackerSupervisorViews>
) {
	const { store, role, sync } = runtime;
	const { database } = store;
	const hub = role === 'hub';
	return {
		node: store.node,
		role,
		pid: process.pid,
		started_at: startedAt,
		db_id: store.dbId,
		ops: store.maxSeq(),
		...trackerStatusDefaults(runtime, hub),
		sync: hub
			? { hub: sync ? 'configured' : 'disabled (no secret)', peers_last_seen: sync?.peers() ?? {} }
			: { disabled: true },
		...views,
		deliveries: deliveryCounts(database),
		active_reminders: count(database, "SELECT count(*) AS n FROM reminders WHERE status = 'active'")
	};
}

function trackerStatusDefaults(runtime: TrackerNativeRuntimeService, hub: boolean) {
	const { store, scheduler } = runtime;
	const notification = runtime.notifications?.status();
	const activeRuns = exists(store.database, 'runs')
		? count(
				store.database,
				"SELECT count(*) AS n FROM runs WHERE state IN ('queued','running','verifying')"
			)
		: 0;
	return {
		chief_of_staff: notification?.chiefOfStaff ?? 'not configured',
		backup: { enabled: false, note: 'backups run on the hub (set backup.enabled to change)' },
		machines: [],
		webhook:
			notification?.webhook ??
			(hub
				? { sender: false, note: 'webhook sender is disabled' }
				: { sender: false, note: 'only the hub sends webhook events' }),
		jobs: runtime.recurring?.status() ?? {
			enabled: false,
			jobs: exists(store.database, 'box_jobs')
				? count(store.database, 'SELECT count(*) AS n FROM box_jobs')
				: 0,
			running: [],
			queued: 0
		},
		adapters: runtime.adapter?.status() ?? { runner: null, active: false },
		autolaunch: {
			enabled: false,
			stuck: [],
			...scheduler?.status(),
			active_runs: activeRuns,
			computers: []
		},
		quiet_hours: notification?.quietHours ?? null
	};
}

function deliveryCounts(database: SqliteDatabase) {
	const rows = database
		.prepare('SELECT status, count(*) AS n FROM deliveries GROUP BY status')
		.all() as { status: string; n: number }[];
	return Object.fromEntries(rows.map(({ status, n }) => [status, n]));
}

function count(database: SqliteDatabase, sql: string): number {
	return (database.prepare(sql).get() as { n: number }).n;
}

function exists(database: SqliteDatabase, name: string): boolean {
	return Boolean(
		database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name)
	);
}
