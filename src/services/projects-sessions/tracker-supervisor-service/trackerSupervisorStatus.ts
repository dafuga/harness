// @harness-uid u_46eur7qage
import { z } from 'zod';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerMachineSummary } from '../tracker-machine-service/trackerMachineSummary';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import { trackerRunnerSample } from '../tracker-native-runtime-service/nativeTrackerLinks';
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
		machines: runtime.machines.rows().map(trackerMachineSummary),
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
	return {
		chief_of_staff: notification?.chiefOfStaff ?? 'not configured',
		backup: { enabled: false, note: 'backups run on the hub (set backup.enabled to change)' },
		webhook: notification?.webhook ?? defaultWebhookStatus(hub),
		jobs: trackerJobsStatus(runtime),
		adapters: runtime.adapter?.status() ?? { runner: null, active: false },
		autolaunch: trackerAutolaunchStatus(runtime),
		quiet_hours: null
	};
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

function trackerAutolaunchStatus(runtime: TrackerNativeRuntimeService) {
	const runs = activeRunCounts(runtime.store.database);
	const now = runtime.now();
	const samples = machineSamplesByNode(runtime.fleetSamples?.() ?? []);
	const status = runtime.scheduler?.status();
	return {
		enabled: status?.enabled ?? false,
		stuck: (status?.stuck ?? []).map((item) => {
			if (item.reason !== 'ready but has not started') return item;
			const sample = samples.get(canonicalNode(item.computer, {}));
			const runner = trackerRunnerSample.safeParse(sample?.runner).data;
			const reason = machineOffline(sample?.at, now) ? undefined : runner?.waiting?.[item.id];
			return reason ? { ...item, reason } : item;
		}),
		active_runs: runs.active,
		computers: trackerFleetHealth(runtime, runs.started, { now, samples })
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
function trackerFleetHealth(
	runtime: TrackerNativeRuntimeService,
	startedRuns: number,
	{ now, samples }: { now: number; samples: ReturnType<typeof machineSamplesByNode> }
) {
	const { store, scheduler, fleetSamples } = runtime;
	const localRunner: z.infer<typeof trackerRunnerSample> = scheduler?.runnerStatus() ?? {
		enabled: false
	};
	const nodes = new Set([...trackerFleetNodes, ...samples.keys(), store.node]);
	return [...nodes].map((computer) => {
		const local = computer === store.node;
		const sample = samples.get(computer);
		const runner = local ? localRunner : trackerRunnerSample.safeParse(sample?.runner).data;
		const offline = !local && Boolean(fleetSamples) && machineOffline(sample?.at, now);
		return {
			computer,
			state: offline ? 'offline' : fleetRunnerState(runner, now),
			...fleetRunnerDetails(runner, local ? startedRuns : runner?.active)
		};
	});
}

function machineOffline(sampledAt: string | undefined, now: number) {
	return !sampledAt || now - Date.parse(sampledAt) > 300_000;
}

function fleetRunnerDetails(
	{
		last_tick_at = null,
		last_error = null,
		waiting_on = null
	}: z.infer<typeof trackerRunnerSample> = {},
	active: number | null | undefined
) {
	return { last_tick_at, last_error, waiting_on, active_runs: active ?? null };
}

function machineSamplesByNode(values: readonly unknown[]) {
	const samples = new Map<string, z.infer<typeof machineSample>>();
	for (const value of values) {
		const sample = machineSample.safeParse(value).data;
		if (sample && Number.isFinite(Date.parse(sample.at))) samples.set(sample.node, sample);
	}
	return samples;
}

function fleetRunnerState(runner: z.infer<typeof trackerRunnerSample> | undefined, now: number) {
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
