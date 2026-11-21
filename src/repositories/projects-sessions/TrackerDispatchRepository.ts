// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchDecision,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../../services/agents-providers/TrackerDispatcherService.types';
import { canonicalNode } from '../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
import { trackerClockMilliseconds } from '../../utils/projects-sessions/nextTrackerClock';
import type {
	TrackerDispatchCandidate,
	TrackerDispatchRepositoryOptions,
	TrackerDispatchRow
} from './TrackerDispatchRepository.types';
import {
	dispatchItem,
	dispatchJournalFields
} from './tracker-dispatch-repository/dispatchItemFields';
import {
	adoptLegacyDispatchRun,
	assertLegacyDispatchRollbackSafe,
	dispatchRunRows,
	legacyDispatchRuns,
	managedDispatchRuns,
	persistDispatchRun
} from './tracker-dispatch-repository/dispatchRunRows';
import { trackerRunSchema } from './tracker-dispatch-repository/trackerRunSchema';

const dueStartKey = 'due_scheduler_last_grant';
const previousDueStartKey = 'harness_dispatch_last_due_start';

/** Share legacy run rows and the item journal while serializing native launch decisions. */
export class TrackerDispatchRepository implements TrackerDispatchStore {
	private readonly node: string;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly options: TrackerDispatchRepositoryOptions = {}
	) {
		this.node = canonicalNode(store.node, options.policy ?? {});
		store.database.exec(trackerRunSchema);
	}

	async update(
		itemId: string,
		decide: (snapshot: TrackerDispatchSnapshot) => TrackerDispatchDecision
	): Promise<TrackerDispatchResult> {
		return this.store.commitLocal(() => {
			const { result, writes } = decide(this.snapshot(itemId));
			for (const run of writes?.runs ?? []) persistDispatchRun(this.store, run, this.node);
			if (writes?.lastDueStartAt !== undefined)
				this.store.writeMeta({ [dueStartKey]: String(writes.lastDueStartAt) });
			const fields = writes?.item && dispatchJournalFields(writes.item);
			return { result, operation: fields && { itemId, fields } };
		});
	}

	managedRuns(): TrackerRunReceipt[] {
		return managedDispatchRuns(this.store.database, this.node);
	}

	legacyRuns(): TrackerRunReceipt[] {
		return legacyDispatchRuns(this.store.database, this.node);
	}

	adoptLegacy(run: TrackerRunReceipt, session: TrackerSessionEvidence): void {
		adoptLegacyDispatchRun(this.store, run, session);
	}

	/** Call after quiescing the native writer, before starting the legacy dispatcher. */
	assertLegacyRollbackSafe(): void {
		assertLegacyDispatchRollbackSafe(this.store.database);
	}

	candidates(): TrackerDispatchCandidate[] {
		return this.store.database
			.prepare(
				`SELECT id, auto, launch_source, nullif(coalesce(launch_target, computer), 'auto') AS launch_target
			FROM items WHERE deleted = 0 AND title IS NOT NULL AND (needs_daniel = 0 OR resolved = 1)
			AND status IN ('open','in_progress') AND every IS NULL
			ORDER BY (due IS NULL), due, created_at, id`
			)
			.all() as TrackerDispatchCandidate[];
	}

	stuckRequests() {
		const now = this.options.now?.() ?? Date.now();
		const pending = this.store.database
			.prepare(
				`SELECT i.id, i.title, i.clocks,
			nullif(coalesce(i.launch_target, i.computer), 'auto') AS computer
			FROM items i WHERE i.deleted = 0 AND i.title IS NOT NULL AND i.status IN ('open','in_progress')
			AND i.auto IS NOT NULL AND NOT EXISTS
				(SELECT 1 FROM runs r WHERE r.item_id = i.id AND r.auto_token = i.auto AND r.started_at IS NOT NULL)
			AND NOT EXISTS
				(SELECT 1 FROM remote_runs r WHERE r.item_id = i.id AND r.auto_token = i.auto AND r.started_at IS NOT NULL)
			ORDER BY i.id`
			)
			.all() as { id: string; title: string; clocks: string; computer: string | null }[];
		return pending.flatMap(({ clocks, ...item }) => {
			const clock = (JSON.parse(clocks) as { auto?: string }).auto;
			const requested = clock && trackerClockMilliseconds(clock);
			return requested && now - requested >= 300_000
				? [{ ...item, requested_at: new Date(requested).toISOString() }]
				: [];
		});
	}

	private snapshot(itemId: string): TrackerDispatchSnapshot {
		const database = this.store.database;
		const row = database.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as
			| TrackerDispatchRow
			| undefined;
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
			openSession: sessions?.openSession === true || this.unmanagedSession(itemId),
			due: this.options.due?.(),
			lastDueStartAt: lastDueStartAt === null ? undefined : Number(lastDueStartAt)
		};
	}

	private unmanagedSession(itemId: string): boolean {
		const now = this.options.now?.() ?? Date.now();
		const recent = now - (this.options.policy?.maxRunMinutes ?? 480) * 60_000;
		const db = this.store.database;
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
}
