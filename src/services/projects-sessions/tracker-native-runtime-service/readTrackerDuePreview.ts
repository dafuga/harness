// @harness-uid u_bl6xl2h4a3
import { dispatchItem } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import type { TrackerDispatchRow } from '../../../repositories/projects-sessions/TrackerDispatchRepository.types';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { projectOf } from '../../../utils/agents-providers/classifyTrackerTask';
import {
	isDueNow,
	schedulingHold
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';

/** Inspect local due work without requesting a launch or reserving capacity. */
export function readTrackerDuePreview(runtime: TrackerNativeRuntimeService) {
	const { store, duePreview } = runtime;
	const { enabled, adapterDue, paused } = duePreview.due();
	const rows = store.database
		.prepare(
			`SELECT * FROM items WHERE deleted = 0 AND title IS NOT NULL AND due IS NOT NULL
		 AND status NOT IN ('done', 'ignored') ORDER BY due, created_at, id`
		)
		.all() as TrackerDispatchRow[];
	const now = runtime.now();
	const entries = rows
		.filter((row) => isDueNow(row.due, duePreview.timeZone, now))
		.map((row) => {
			const entry = { id: row.id, title: row.title, due: row.due };
			const plan = duePreview.preview?.(row.id);
			if (!plan?.pick) return { ...entry, reason: plan?.reason ?? holdWithoutRunner(row, paused) };
			return {
				...entry,
				computer: plan.target,
				project: projectOf({ project: row.project, agent: row.agent }),
				model: plan.pick.rung.model,
				effort: plan.pick.rung.effort ?? null,
				reason: plan.reason
			};
		});
	return {
		enabled,
		adapter_due_enabled: adapterDue === true,
		paused,
		source: store.node,
		launches: entries.filter((entry) => 'computer' in entry),
		skipped: entries.filter((entry) => !('computer' in entry))
	};
}

function holdWithoutRunner(row: TrackerDispatchRow, paused: boolean): string {
	const item = dispatchItem(row, []);
	return (
		schedulingHold(item) ??
		(paused ? 'due scheduling is paused' : 'native due scheduler is disabled')
	);
}

export function trackerDueItemPreview(
	runtime: TrackerNativeRuntimeService,
	item: TrackerItem
): string | null {
	if (item.schedule_off) return 'automatic launch opted out';
	const { duePreview } = runtime;
	if (
		item.status === 'done' ||
		item.status === 'ignored' ||
		!isDueNow(item.due, duePreview.timeZone, runtime.now())
	)
		return null;
	const plan = duePreview.preview?.(item.id);
	if (plan?.pick) {
		const { model, effort } = plan.pick.rung;
		return `would launch on ${plan.target} (${[model, effort].filter(Boolean).join(':')})`;
	}
	return plan?.reason ?? item.schedule_status;
}
