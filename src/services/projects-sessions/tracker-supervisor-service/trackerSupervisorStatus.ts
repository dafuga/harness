// @harness-uid u_46eur7qage
import { z } from 'zod';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { trackerFleetNodes } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
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
			: runtime.spokeStatus(),
		...views,
		deliveries: deliveryCounts(database),
		active_reminders: count(database, "SELECT count(*) AS n FROM reminders WHERE status = 'active'")
	};
}

function trackerStatusDefaults(runtime: TrackerNativeRuntimeService, hub: boolean) {
	const notification = runtime.notifications?.status();
	const runs = activeRunCounts(runtime.store.database);
	const computers = trackerFleetHealth(runtime, runs.started);
	return {
		chief_of_staff: notification?.chiefOfStaff ?? 'not configured',
		backup: { enabled: false, note: 'backups run on the hub (set backup.enabled to change)' },
		machines: computers.map(machineFromComputer),
		webhook: notification?.webhook ?? defaultWebhookStatus(hub),
		jobs: trackerJobsStatus(runtime),
		adapters: runtime.adapter?.status() ?? { runner: null, active: false },
		autolaunch: trackerAutolaunchStatus(runtime, runs.active, computers),
		quiet_hours: notification?.quietHours ?? null
	};
}

type FleetComputer = ReturnType<typeof trackerFleetHealth>[number];

/**
 * The overview status of one computer. Only a polling launcher counts as reachable; offline,
 * stale, failing, disabled and unknown computers all read as offline, so none is shown as
 * available without a fresh tick. A polling computer with launches held behind it is
 * overloaded, otherwise one with active runs is busy.
 */
function machineFromComputer(computer: FleetComputer) {
	let status = 'offline';
	if (computer.state === 'polling') {
		if ((computer.queued ?? 0) > 0) status = 'overloaded';
		else status = (computer.active_runs ?? 0) > 0 ? 'busy' : 'ok';
	}
	return { node: computer.computer, status, last_tick_at: computer.last_tick_at };
}

function defaultWebhookStatus(hub: boolean) {
	return {
		sender: false,
		note: hub ? 'webhook sender is disabled' : 'only the hub sends webhook events'
	};
}

function trackerJobsStatus({ store, recurring }: TrackerNativeRuntimeService) {
	return (
		recurring?.status() ?? {
			enabled: false,
			jobs: exists(store.database, 'box_jobs')
				? count(store.database, 'SELECT count(*) AS n FROM box_jobs')
				: 0,
			running: [],
			queued: 0
		}
	);
}

function trackerAutolaunchStatus(
	runtime: TrackerNativeRuntimeService,
	activeRuns: number,
	computers: FleetComputer[]
) {
	return {
		enabled: false,
		stuck: [],
		...runtime.scheduler?.status(),
		active_runs: activeRuns,
		computers
	};
}

function activeRunCounts(database: SqliteDatabase) {
	if (!exists(database, 'runs')) return { active: 0, started: 0 };
	return database
		.prepare(
			`SELECT count(*) AS active,
		count(CASE WHEN state IN ('running','verifying') THEN 1 END) AS started
		FROM runs WHERE state IN ('queued','running','verifying')`
		)
		.get() as {
		active: number;
		started: number;
	};
}

const machineSample = z.object({ node: z.string().min(1), at: z.string(), runner: z.unknown() });
const runnerSample = z.object({
	enabled: z.boolean().nullish(),
	last_tick_at: z.string().nullish(),
	last_error: z.string().nullish(),
	waiting_on: z.string().nullish(),
	active: z.int().nonnegative().nullish(),
	queued: z.int().nonnegative().nullish()
});

function trackerFleetHealth(runtime: TrackerNativeRuntimeService, startedRuns: number) {
	const { store, scheduler, fleetSamples } = runtime;
	const now = runtime.now();
	const samples = machineSamplesByNode(fleetSamples?.() ?? []);
	const localRunner: z.infer<typeof runnerSample> = scheduler?.runnerStatus() ?? { enabled: false };
	const nodes = new Set([...trackerFleetNodes, ...samples.keys(), store.node]);
	return [...nodes].map((computer) => {
		const local = computer === store.node;
		const sample = samples.get(computer);
		const runner = local ? localRunner : runnerSample.safeParse(sample?.runner).data;
		const offline = !local && Boolean(fleetSamples) && machineOffline(sample?.at, now);
		return {
			computer,
			state: offline ? 'offline' : fleetRunnerState(runner, now),
			...fleetRunnerDetails(runner, local ? startedRuns : runner?.active, runner?.queued)
		};
	});
}

function machineOffline(sampledAt: string | undefined, now: number) {
	return !sampledAt || now - Date.parse(sampledAt) > 300_000;
}

function fleetRunnerDetails(
	{ last_tick_at = null, last_error = null, waiting_on = null }: z.infer<typeof runnerSample> = {},
	active: number | null | undefined,
	queued: number | null | undefined
) {
	return { last_tick_at, last_error, waiting_on, active_runs: active ?? null, queued: queued ?? 0 };
}

function machineSamplesByNode(values: readonly unknown[]) {
	const samples = new Map<string, z.infer<typeof machineSample>>();
	for (const value of values) {
		const sample = machineSample.safeParse(value).data;
		if (sample && Number.isFinite(Date.parse(sample.at))) samples.set(sample.node, sample);
	}
	return samples;
}

function fleetRunnerState(runner: z.infer<typeof runnerSample> | undefined, now: number) {
	if (runner?.enabled == null) return 'unknown';
	if (!runner.enabled) return 'disabled';
	if (runner.last_error) return 'error';
	return runner.last_tick_at && now - Date.parse(runner.last_tick_at) <= 120_000
		? 'polling'
		: 'stale';
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
