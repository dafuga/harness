// @harness-uid u_gs5pnxnxt4
import type { TrackerModelItem } from './classifyTrackerTask.types';
import { ladderFrom } from './parseTrackerModelSpec';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import { pickTrackerModel, trackerSelectionContext } from './pickTrackerModel';
import type { TrackerRetryOptions, TrackerRetryRun } from './pickTrackerModel.types';
import { nextRouteRung } from './preferredClaudeRoute';
import { hardEscalation } from './trackerEscalation';
import { explicitModelSelection } from './trackerExplicitModel';
import { trackerModelRoute } from './trackerModelRoute';
import { trackerTaskType } from './trackerTaskType';

/** One rung up after a failed attempt or a lost session; evidence includes that attempt. */
export function retryTrackerModel(
	item: TrackerModelItem,
	run: TrackerRetryRun,
	options: TrackerRetryOptions = {}
): TrackerModelRung {
	const ladder = ladderFrom(options.cfg);
	const context = trackerSelectionContext(item, options);
	const explicit = explicitModelSelection(item, ladder, context.kind);
	if (explicit) return explicit.rung;
	if (run.pinned)
		return pickTrackerModel({ ...item, model: `${run.model}:${run.effort ?? ''}` }, options).rung;
	const next = nextRouteRung(trackerModelRoute(item, ladder, context), run);
	if (trackerTaskType(item) === 'computer-use') return next;
	const escalation = hardEscalation(options.evidence, {
		ladder,
		cfg: options.cfg,
		claudeOnly: context.claude
	});
	return escalation?.rung ?? next;
}
