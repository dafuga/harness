// @harness-uid u_gs5pnxnxt4
import {
	classifyTrackerTask,
	floorReasons,
	isExplicitlyHard,
	isHarnessModule,
	isLightClaudeWork,
	sizeOf,
	trackerTaskRoute
} from './classifyTrackerTask';
import type { TrackerModelItem } from './classifyTrackerTask.types';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import type {
	ClaudeRoute,
	PreferredSelectionContext,
	TrackerModelSelection
} from './pickTrackerModel.types';

/** The reason text every run records while the provider preference is on. */
export function claudePreferenceNote(until: string) {
	return `Claude only until ${until}`;
}

/** The preference's end while it is still in the future. */
export function activePreferenceEnd(until: string | null | undefined, now: number = Date.now()) {
	return until && now < Date.parse(until) ? until : undefined;
}

/**
 * model-status.md's Claude rung for each work kind while Daniel prefers Claude. Deploys keep
 * their model and computer use stays on Terra. Later steps are the retry escalation.
 */
export function preferredClaudeRoute(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	restricted: boolean
): ClaudeRoute {
	const [haiku, sonnet, terra, , opus] = ladder;
	const [low, medium, high] = ['low', 'medium', 'high'].map((effort) => ({ ...sonnet, effort }));
	const top = { ...opus, effort: 'high' };
	const plan = (steps: TrackerModelRung[], why: string): ClaudeRoute => ({ steps, why });
	const route = trackerTaskRoute(item);
	const kind = classifyTrackerTask(item);
	if (route === 'live-deploy') return plan([top], 'deploy: Opus high');
	if (route === 'computer-use') return plan([terra], 'computer use: Terra');
	if (kind === 'hard' || isExplicitlyHard(item)) return plan([high, top], 'hard work: Sonnet high');
	if (!restricted && isHarnessModule(item))
		return plan([{ ...haiku, effort: 'medium' }, medium, high, top], 'module job: Haiku medium');
	if (!restricted && route === 'default' && isLightClaudeWork(item, kind, sizeOf(item)))
		return plan([low, medium, high, top], 'simple work: Sonnet low');
	return plan([medium, high, top], 'default work: Sonnet medium');
}

/** A Codex pin cannot start while Daniel prefers Claude, so it takes the work kind's Claude rung. */
export function switchedSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	{ kind, until }: { kind: TrackerModelSelection['kind']; until: string }
): TrackerModelSelection {
	const { steps, why } = preferredClaudeRoute(item, ladder, floorReasons(item).length > 0);
	const [rung] = steps;
	return {
		rung: { ...rung, pinned: true },
		kind,
		reason: `named ${item.model}, switched to ${rung.id} ${rung.effort}; ${why}; ${claudePreferenceNote(until)}`
	};
}

export function preferredSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: PreferredSelectionContext
): TrackerModelSelection {
	const { steps, why } = preferredClaudeRoute(item, ladder, context.restrictions.length > 0);
	const [rung] = steps;
	return {
		rung,
		kind: context.kind,
		reason: `${context.kind}/${context.size}: ${rung.id} ${rung.effort}; ${why}; ${claudePreferenceNote(context.preferred)}`
	};
}
