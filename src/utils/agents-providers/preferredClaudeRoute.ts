// @harness-uid u_gs5pnxnxt4
import { floorReasons } from './classifyTrackerTask';
import type { TrackerModelItem } from './classifyTrackerTask.types';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import type {
	ClaudeRoute,
	TrackerModelSelection,
	TrackerRetryRun,
	TrackerRouteContext
} from './pickTrackerModel.types';
import { claudeTaskRoute, configuredTaskRoute, fixedTaskRoute } from './trackerTaskRoutes';
import { trackerTaskType } from './trackerTaskType';

/** The reason text every run records while the provider preference is on. */
export function claudePreferenceNote(until: string) {
	return `Claude only until ${until}`;
}

/** The preference's end while it is still in the future. */
export function activePreferenceEnd(until: string | null | undefined, now: number = Date.now()) {
	return until && now < Date.parse(until) ? until : undefined;
}

/**
 * The route while Daniel prefers Claude: the operator's table, then the fixed coordinator,
 * design and deploy rules, then model-status.md's Claude rung. Computer use stays on Terra.
 */
export function preferredClaudeRoute(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	restricted: boolean,
	context: TrackerRouteContext = {}
): ClaudeRoute {
	const type = trackerTaskType(item);
	return (
		configuredTaskRoute(ladder, type, { ...context, claudeOnly: true }) ??
		fixedTaskRoute(item, ladder, type) ??
		claudeTaskRoute(type, ladder, restricted)
	);
}

/** A Codex pin cannot start while Daniel prefers Claude, so it takes the work kind's Claude rung. */
export function switchedSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	{ kind, until, cfg }: { kind: TrackerModelSelection['kind']; until: string } & TrackerRouteContext
): Omit<TrackerModelSelection, 'taskType'> {
	const restricted = floorReasons(item).length > 0;
	const { steps, why } = preferredClaudeRoute(item, ladder, restricted, { cfg });
	const [rung] = steps;
	return {
		rung: { ...rung, pinned: true },
		kind,
		reason: `named ${item.model}, switched to ${rung.id} ${rung.effort}; ${why}; ${claudePreferenceNote(until)}`
	};
}

const efforts = ['low', 'medium', 'high', 'xhigh', 'max'];

// A failed rung moves to the next step of its route; an unknown rung restarts at the first.
export function nextRouteRung({ steps }: ClaudeRoute, run: TrackerRetryRun) {
	const id = run.rung === 'sol-xhigh' ? 'sol' : run.rung;
	const exact = steps.findIndex((step) => step.id === id && step.effort === run.effort);
	if (exact >= 0) return steps[Math.min(exact + 1, steps.length - 1)];
	// The same model at an effort the route lacks moves to the next effort above it.
	const ran = efforts.indexOf(run.effort ?? '');
	const above =
		ran < 0 ? undefined : steps.find((s) => s.id === id && efforts.indexOf(s.effort) > ran);
	const last = steps.map((step) => step.id).lastIndexOf(id);
	return above ?? steps[Math.min(last + 1, steps.length - 1)];
}
