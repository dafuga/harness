// @harness-uid u_ksy76trvsj
import type {
	TrackerDispatchDecision,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerRunReceipt
} from '../../services/agents-providers/TrackerDispatcherService.types';
import { canonicalNode } from '../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
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
	dispatchRunRows,
	managedDispatchRuns,
	persistDispatchRun
} from './tracker-dispatch-repository/dispatchRunRows';
import { trackerRunSchema } from './tracker-dispatch-repository/trackerRunSchema';

const dueStartKey = 'harness_dispatch_last_due_start';

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

	candidates(): TrackerDispatchCandidate[] {
		return this.store.database
			.prepare(
				`SELECT id, auto, launch_source, coalesce(launch_target, computer) AS launch_target
			FROM items WHERE deleted = 0 AND title IS NOT NULL AND needs_daniel = 0
			AND status IN ('open','in_progress') AND every IS NULL
			ORDER BY (due IS NULL), due, created_at, id`
			)
			.all() as TrackerDispatchCandidate[];
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
		const lastDueStartAt = this.store.getMeta(dueStartKey);
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
