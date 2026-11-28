// @harness-uid u_gs5pnxnxt4
import {
	classifyTrackerTask,
	isExplicitlyHard,
	isLightClaudeWork,
	sizeOf,
	solEffort,
	trackerTaskRoute
} from './classifyTrackerTask';
import type {
	TrackerModelItem,
	TrackerTaskRoute,
	TrackerTaskType
} from './classifyTrackerTask.types';
import { solEfforts } from './parseTrackerModelSpec';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import type { ClaudeRoute, SelectionContext } from './pickTrackerModel.types';
import { preferredClaudeRoute } from './preferredClaudeRoute';
import { configuredTaskRoute, fixedTaskRoute } from './trackerTaskRoutes';
import { trackerTaskType } from './trackerTaskType';

// model-status.md before the reset: the cheapest Claude rung by task type, then Sonnet high, then Opus high.
function claudeRoute(item: TrackerModelItem, ladder: TrackerModelRung[], restricted: boolean) {
	const [haiku, sonnet, , , opus] = ladder;
	const medium = { ...sonnet, effort: 'medium' };
	const high = { ...sonnet, effort: 'high' };
	const top = { ...opus, effort: 'high' };
	const route = trackerTaskRoute(item);
	const kind = classifyTrackerTask(item);
	const plan = (steps: TrackerModelRung[], why: string): ClaudeRoute => ({ steps, why });
	if (isExplicitlyHard(item)) return plan([top], 'explicitly hard: Opus high');
	if (route === 'computer-use') return plan([high, top], 'computer use: Sonnet high');
	if (route === 'visual') return plan([medium, top], 'design: Sonnet medium');
	if (!restricted && isLightClaudeWork(item, kind, sizeOf(item)))
		return plan([haiku, medium, high, top], 'tests, docs and checks: Haiku high');
	if (kind === 'hard') return plan([high, top], 'hard work: Sonnet high');
	return plan([medium, high, top], 'features, fixes, ops and triage: Sonnet medium');
}

// The Codex ids this work may use. A live deploy named another type with --kind stays on Opus.
function eligibleLadder(route: TrackerTaskRoute, ladder: TrackerModelRung[], restricted: boolean) {
	const [, , terra, sol, opus] = ladder;
	switch (route) {
		case 'live-deploy':
			return [opus];
		case 'computer-use':
			return restricted ? [sol] : [terra, sol];
		default:
			return [sol];
	}
}

// Sol climbs through its efforts, starting at the one this kind of work needs.
function codexRoute(item: TrackerModelItem, ids: TrackerModelRung[], type: TrackerTaskType) {
	const kind = type === 'hard' ? 'hard' : classifyTrackerTask(item);
	const first = solEfforts.indexOf(solEffort(kind, sizeOf(item)));
	const steps = ids.flatMap((rung) =>
		rung.id === 'sol' ? solEfforts.slice(first).map((effort) => ({ ...rung, effort })) : [rung]
	);
	return { steps, why: '' };
}

/** The route automatic choices, raised pins and retries climb for this item right now. */
export function trackerModelRoute(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	{ preferred, claude, restrictions, cfg }: SelectionContext
): ClaudeRoute {
	const restricted = restrictions.length > 0;
	if (preferred) return preferredClaudeRoute(item, ladder, restricted, { cfg });
	const type = trackerTaskType(item);
	const chosen =
		configuredTaskRoute(ladder, type, { cfg, claudeOnly: claude }) ??
		fixedTaskRoute(item, ladder, type);
	if (chosen) return chosen;
	if (claude) return claudeRoute(item, ladder, restricted);
	const route = type === 'computer-use' ? type : trackerTaskRoute(item);
	return codexRoute(item, eligibleLadder(route, ladder, restricted), type);
}
