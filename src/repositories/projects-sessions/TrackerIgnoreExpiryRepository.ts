// @harness-uid u_k2n3yjm2vr
import type { TrackerPersistenceService } from '../../services/projects-sessions/TrackerPersistenceService';
import type { TrackerIgnoredItem } from '../../utils/projects-sessions/planTrackerIgnoreExpiry.types';
import type { TrackerIgnoreExpiryPlan } from './TrackerIgnoreExpiryRepository.types';

const select = `SELECT id, title, status, needs_daniel, resolved, every, ignored_until, ignored_prev_status
	FROM items WHERE deleted = 0 AND title IS NOT NULL AND status = 'ignored' AND ignored_until IS NOT NULL`;

/** Reads ignores that have an end and commits each restore against the current row. */
export class TrackerIgnoreExpiryRepository {
	constructor(private readonly store: TrackerPersistenceService) {}

	/** Writes the planned change for every ignore the plan ends; others take no writer lock. */
	restore(plan: TrackerIgnoreExpiryPlan): void {
		const rows = this.store.database.prepare(select + ' ORDER BY id').all();
		for (const row of rows as unknown as TrackerIgnoredItem[]) {
			if (plan(row)) this.commit(row.id, plan);
		}
	}

	private commit(id: string, plan: TrackerIgnoreExpiryPlan): void {
		this.store.commitLocal(() => {
			const row = this.store.database.prepare(select + ' AND id = ?').get(id) as
				| TrackerIgnoredItem
				| undefined;
			const fields = row && plan(row);
			return { result: undefined, operation: fields && { itemId: id, fields } };
		});
	}
}
