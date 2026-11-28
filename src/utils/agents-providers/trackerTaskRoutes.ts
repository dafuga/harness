// @harness-uid u_gs5pnxnxt4
import { projectOf } from './classifyTrackerTask';
import type { TrackerModelItem, TrackerTaskType } from './classifyTrackerTask.types';
import { parseTrackerModelSpec } from './parseTrackerModelSpec';
import type { TrackerModelRung } from './parseTrackerModelSpec.types';
import type { ClaudeRoute, TrackerRouteContext } from './pickTrackerModel.types';

const plan = (steps: TrackerModelRung[], why: string): ClaudeRoute => ({ steps, why });

function claudeSteps(ladder: TrackerModelRung[]) {
	const [haiku, sonnet, terra, , opus] = ladder;
	const [low, medium, high] = ['low', 'medium', 'high'].map((effort) => ({ ...sonnet, effort }));
	return {
		haiku: { ...haiku, effort: 'medium' },
		low,
		medium,
		high,
		terra,
		top: { ...opus, effort: 'high' }
	};
}

/** The routes that hold with or without a provider preference. */
export function fixedTaskRoute(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	type: TrackerTaskType
): ClaudeRoute | undefined {
	const { high, top } = claudeSteps(ladder);
	if (type === 'coordinator') return plan([top], 'coordinator: Opus high');
	if (type === 'design') return plan([parseUnpinned('fable:high', ladder)], 'design: Fable high');
	if (type !== 'deploy') return undefined;
	return /buildflexity/i.test(projectOf(item) ?? item.title ?? '')
		? plan([top], 'deploy: Opus high')
		: plan([high, top], 'deploy: Sonnet high');
}

/** model-status.md's Claude rung for each task type. Later steps are the retry escalation. */
export function claudeTaskRoute(
	type: TrackerTaskType,
	ladder: TrackerModelRung[],
	restricted: boolean
): ClaudeRoute {
	const { haiku, low, medium, high, terra, top } = claudeSteps(ladder);
	if (type === 'computer-use') return plan([terra], 'computer use: Terra');
	if (type === 'hard') return plan([high, top], 'hard work: Sonnet high');
	if (!restricted && type === 'module-job')
		return plan([haiku, medium, high, top], 'module job: Haiku medium');
	if (!restricted && type === 'simple')
		return plan([low, medium, high, top], 'simple work: Sonnet low');
	return plan([medium, high, top], 'default work: Sonnet medium');
}

/** The operator's own route for a task type. Astra is an escalation and never a first choice. */
export function configuredTaskRoute(
	ladder: TrackerModelRung[],
	type: TrackerTaskType,
	{ cfg, claudeOnly }: TrackerRouteContext
): ClaudeRoute | undefined {
	const specs = cfg?.autolaunch?.taskRoutes?.[type] ?? [];
	const named = specs.map((spec) => parseUnpinned(spec, ladder));
	const allowed = named.filter((step) => !claudeOnly || allowedOnClaude(step, type));
	const first = allowed.findIndex(({ model }) => !/astra/i.test(model));
	return first < 0 ? undefined : plan(allowed.slice(first), `${type}: configured route`);
}

function allowedOnClaude({ cli }: TrackerModelRung, type: TrackerTaskType) {
	return cli === 'claude' || type === 'computer-use';
}

export function parseUnpinned(spec: string, ladder: TrackerModelRung[]): TrackerModelRung {
	const rung = parseTrackerModelSpec(spec, ladder);
	delete rung.pinned;
	return rung;
}
