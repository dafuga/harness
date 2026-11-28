// @harness-uid u_ksy76trvsj
import {
	trackerBudgetNode,
	trackerHomeProject
} from '../../utils/projects-sessions/trackerCpuBudget';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerDispatchDecision,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../../services/agents-providers/TrackerDispatcherService.types';
import { canonicalNode } from '../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { launchStartupGrace } from '../../services/agents-providers/tracker-dispatcher-service/runClaim';
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
import { trackerClockMilliseconds } from '../../utils/projects-sessions/nextTrackerClock';
import type {
	TrackerDispatchCandidate,
	TrackerDispatchRepositoryOptions,
	TrackerDispatchRow
} from './TrackerDispatchRepository.types';
import {
	dispatchItem,
	dispatchLaunchSource
} from './tracker-dispatch-repository/dispatchItemFields';
import {
	adoptLegacyDispatchRun,
	assertLegacyDispatchRollbackSafe,
	dispatchRunRows,
	legacyDispatchRuns,
	legacyUnstarted,
	managedDispatchRuns
} from './tracker-dispatch-repository/dispatchRunRows';
import { commitDecision, dueStartKey } from './tracker-dispatch-repository/dispatchCommit';
import { humanRedoCandidates } from './tracker-dispatch-repository/dispatchHumanRedo';
import { trackerDispatchControl } from './tracker-dispatch-repository/dispatchLaunchControl';
import { trackerRunSchema } from './tracker-dispatch-repository/trackerRunSchema';

const previousDueStartKey = 'harness_dispatch_last_due_start';

/** Share legacy run rows and the item journal while serializing native launch decisions. */
export class TrackerDispatchRepository implements TrackerDispatchStore {
	private readonly node: string;
	readonly launches;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly options: TrackerDispatchRepositoryOptions = {}
	) {
		this.node = canonicalNode(store.node, options.policy ?? {});
		this.launches = trackerDispatchControl(
			store,
			this.node,
			(id) => this.readSnapshot(id),
			options.now ?? Date.now
		);
		store.database.exec(trackerRunSchema);
	}

	async update(
		itemId: string,
		decide: (snapshot: TrackerDispatchSnapshot) => TrackerDispatchDecision
	): Promise<TrackerDispatchResult> {
		const target = { ...this.options, store: this.store, node: this.node };
		const read = (id: string) => this.readSnapshot(id);
		return commitDecision(target, { itemId, read }, decide);
	}

	managedRuns(): TrackerRunReceipt[] {
		return managedDispatchRuns(this.store.database, this.node);
	}

	legacyRuns(): TrackerRunReceipt[] {
		const now = this.options.now?.() ?? Date.now();
		return legacyDispatchRuns(this.store.database, this.node, now - launchStartupGrace);
	}

	adoptLegacy(run: TrackerRunReceipt, session: TrackerSessionEvidence): void {
		adoptLegacyDispatchRun(this.store, run, session);
	}

	retireLegacy(run: TrackerRunReceipt): void {
		this.store.commitLocal(() => {
			const now = this.options.now?.() ?? Date.now();
			this.store.database
				.prepare(
					`UPDATE runs AS r SET state = 'finished', outcome = 'abandoned',
					failure_reason = 'legacy launch expired before startup', ended_at = ?
				WHERE r.id = ? AND r.item_id = ? AND r.auto_token = ? AND r.queued_at = ?
				AND ${legacyUnstarted}
				AND NOT EXISTS (SELECT 1 FROM meta WHERE k = 'harness_dispatch_run:' || r.id)`
				)
				.run(now, run.id, run.item_id, run.auto_token, run.queued_at);
			return { result: undefined };
		});
	}

	/** Call after quiescing the native writer, before starting the legacy dispatcher. */
	assertLegacyRollbackSafe(): void {
		assertLegacyDispatchRollbackSafe(this.store.database);
	}

	candidates(): TrackerDispatchCandidate[] {
		return this.store.database
			.prepare(
				`SELECT id, auto, priority, ${dispatchLaunchSource} AS launch_source, nullif(coalesce(launch_target, computer), 'auto') AS launch_target
			FROM items i WHERE deleted = 0 AND title IS NOT NULL AND (needs_daniel = 0 OR resolved = 1)
			AND status IN ('open','in_progress') AND every IS NULL AND coalesce(kind, 'task') = 'task'
			AND (i.auto IS NULL OR (
				NOT EXISTS (SELECT 1 FROM runs r WHERE r.item_id = i.id AND r.auto_token = i.auto)
				AND NOT EXISTS (SELECT 1 FROM remote_runs r WHERE r.item_id = i.id AND r.auto_token = i.auto)
			))
			ORDER BY ${trackerBudgetNode(this.node) ? `lower(coalesce(i.project, i.agent, '')) <> '${trackerHomeProject}',` : ''}
				(i.auto IS NULL OR launch_source <> 'manual'),
				CASE i.priority WHEN 'urgent' THEN 0 WHEN 'low' THEN 2 ELSE 1 END,
				(i.adapter_due_owner IS NULL),
				(due IS NULL), due, created_at, id`
			)
			.all() as TrackerDispatchCandidate[];
	}

	humanRedoCandidates() {
		return humanRedoCandidates(this.store.database);
	}

	stuckRequests(minimumAge = 300_000) {
		const now = this.options.now?.() ?? Date.now();
		return trackerStuckRequests(this.store.database, { now, minimumAge });
	}

	readSnapshot(itemId: string): TrackerDispatchSnapshot {
		const database = this.store.database;
		const row = database
			.prepare(`SELECT i.*, ${dispatchLaunchSource} AS dispatch_source FROM items i WHERE i.id = ?`)
			.get(itemId) as TrackerDispatchRow | undefined;
		const runs = dispatchRunRows(database, this.node, itemId);
		const { id } = database
			.prepare(
				"SELECT max(coalesce((SELECT seq FROM sqlite_sequence WHERE name = 'runs'), 0), coalesce((SELECT max(id) FROM runs), 0)) + 1 AS id"
			)
			.get() as { id: number };
		const sessions = this.options.sessions?.(itemId);
		const lastDueStartAt =
			this.store.getMeta(dueStartKey) ?? this.store.getMeta(previousDueStartKey);
		return {
			item: row ? dispatchItem(row, runs) : null,
			runs,
			nextRunId: id,
			activeSessionKeys: sessions?.activeSessionKeys,
			openSession:
				Boolean(sessions?.openSession) || hasUnmanagedSession(database, itemId, this.options),
			due: this.options.due?.(),
			lastDueStartAt: lastDueStartAt === null ? undefined : Number(lastDueStartAt)
		};
	}
}

function hasUnmanagedSession(
	db: SqliteDatabase,
	itemId: string,
	options: TrackerDispatchRepositoryOptions
): boolean {
	const now = options.now?.() ?? Date.now();
	const recent = now - (options.policy?.maxRunMinutes ?? 480) * 60_000;
	return Boolean(
		db
			.prepare(
				"SELECT 1 FROM runs WHERE item_id = ? AND (auto_token IS NULL OR state = 'observed') AND state IN ('queued','running','verifying','observed') LIMIT 1"
			)
			.get(itemId) ??
		db
			.prepare(
				"SELECT 1 FROM remote_runs WHERE item_id = ? AND (auto_token IS NULL OR state = 'observed') AND state IN ('queued','running','verifying','observed') AND coalesce(resumed_at, started_at, queued_at, 0) >= ? LIMIT 1"
			)
			.get(itemId, recent)
	);
}

function trackerStuckRequests(
	database: SqliteDatabase,
	{ now, minimumAge }: { now: number; minimumAge: number }
) {
	const pending = database
		.prepare(
			`SELECT i.id, i.title, i.clocks, (i.needs_daniel = 1 AND i.resolved = 0) AS flagged,
		nullif(coalesce(i.launch_target, i.computer), 'auto') AS computer
		FROM items i WHERE i.deleted = 0 AND i.title IS NOT NULL AND i.status IN ('open','in_progress')
		AND i.auto IS NOT NULL AND NOT EXISTS (
			SELECT count(*) FROM (
				SELECT state, started_at FROM runs WHERE item_id = i.id AND auto_token = i.auto
				UNION ALL
				SELECT state, started_at FROM remote_runs WHERE item_id = i.id AND auto_token = i.auto
			)
			HAVING count(started_at) > 0 OR (count(*) > 0 AND count(CASE WHEN state = 'queued' THEN 1 END) = 0)
		)
		ORDER BY i.id`
		)
		.all() as {
		id: string;
		title: string;
		clocks: string;
		computer: string | null;
		flagged: number;
	}[];
	return pending.flatMap(({ clocks, ...item }) => {
		const clock = (JSON.parse(clocks) as { auto?: string }).auto;
		const requested = clock && trackerClockMilliseconds(clock);
		return requested && now - requested >= minimumAge
			? [{ ...item, requested_at: new Date(requested).toISOString() }]
			: [];
	});
}
