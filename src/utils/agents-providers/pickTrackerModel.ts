// @harness-uid u_gs5pnxnxt4
import { ladderFrom, parseTrackerModelSpec, solEfforts } from './parseTrackerModelSpec';
import {
	classifyTrackerTask,
	floorReasons,
	isExplicitlyHard,
	isHarnessModule,
	isLightClaudeWork,
	sizeOf,
	solEffort,
	trackerTaskRoute
} from './classifyTrackerTask';
import {
	activePreferenceEnd,
	nextClaudeRung,
	preferredClaudeRoute,
	preferredSelection,
	switchedSelection
} from './preferredClaudeRoute';
import type {
	TrackerLadderConfig,
	TrackerLearningConfig,
	TrackerModelRung
} from './parseTrackerModelSpec.types';
import type {
	TrackerModelHistory,
	ClaudeRoute,
	PinContext,
	SelectionContext,
	TrackerModelSelection,
	TrackerModelSelectionOptions,
	TrackerRetryOptions,
	TrackerRetryRun
} from './pickTrackerModel.types';
import type { TrackerModelItem, TrackerTaskRoute } from './classifyTrackerTask.types';

const codexResetAt = Date.parse('2026-11-27T10:39:00Z');

function claudeOnly({ cfg, now }: { cfg?: TrackerLadderConfig; now?: number }) {
	const until = Date.parse(cfg?.autolaunch?.claudeOnlyUntil ?? '');
	return (now ?? Date.now()) < (Number.isNaN(until) ? codexResetAt : until);
}

// model-status.md before the reset: the cheapest Claude rung by task type, then Sonnet high, then Opus high.
function claudeRoute(item: TrackerModelItem, ladder: TrackerModelRung[], restricted: boolean) {
	const [haiku, sonnet, , , opus] = ladder;
	const medium = { ...sonnet, effort: 'medium' };
	const high = { ...sonnet, effort: 'high' };
	const top = { ...opus, effort: 'high' };
	const route = trackerTaskRoute(item);
	const kind = classifyTrackerTask(item);
	const plan = (steps: TrackerModelRung[], why: string): ClaudeRoute => ({ steps, why });
	if (route === 'live-deploy') return plan([top], 'deploy: Opus high');
	if (isExplicitlyHard(item)) return plan([top], 'explicitly hard: Opus high');
	if (route === 'computer-use') return plan([high, top], 'computer use: Sonnet high');
	if (route === 'visual') return plan([medium, top], 'design: Sonnet medium');
	if (!restricted && isLightClaudeWork(item, kind, sizeOf(item)))
		return plan([haiku, medium, high, top], 'tests, docs and checks: Haiku high');
	if (kind === 'hard') return plan([high, top], 'hard work: Sonnet high');
	return plan([medium, high, top], 'features, fixes, ops and triage: Sonnet medium');
}

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

export function pickTrackerModel(
	item: TrackerModelItem,
	options: TrackerModelSelectionOptions = {}
): TrackerModelSelection {
	const ladder = ladderFrom(options.cfg);
	const preferred = activePreferenceEnd(options.claudePreferredUntil, options.now);
	const context = {
		preferred,
		kind: classifyTrackerTask(item),
		size: sizeOf(item),
		route: trackerTaskRoute(item),
		restrictions: floorReasons(item),
		claude: Boolean(preferred) || claudeOnly(options)
	};
	return item.model
		? pinnedSelection(item, ladder, context)
		: automaticSelection(item, ladder, context, options);
}

function pinnedSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext
): TrackerModelSelection {
	const { kind, size, route, preferred } = context;
	const rung = parseTrackerModelSpec(item.model ?? '', ladder);
	if (preferred && rung.cli === 'codex' && route !== 'computer-use')
		return switchedSelection(item, ladder, { kind, until: preferred });
	const raised = raisedPinReason(item, rung, context);
	if (!raised) return { rung, kind, reason: `named on the item (${item.model})` };
	const replacement = raisedRung(item, ladder, context);
	const name = { opus: 'Opus', sonnet: 'Sonnet' }[replacement.id] ?? 'Sol';
	const effort = replacement.id === 'sol' ? solEffort(kind, size) : replacement.effort;
	return {
		rung: { ...replacement, effort, pinned: true },
		kind,
		reason: `named ${item.model}, raised to ${name} (${raised})`
	};
}

function raisedRung(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	{ route, claude, preferred }: SelectionContext
) {
	const routeFor = preferred ? preferredClaudeRoute : claudeRoute;
	return claude
		? routeFor(item, ladder, true).steps[0]
		: eligibleLadder(route === 'live-deploy' ? route : 'default', ladder, true)[0];
}

function automaticSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext,
	{ cfg, history }: TrackerModelSelectionOptions
): TrackerModelSelection {
	const { kind, size, route, restrictions, claude, preferred } = context;
	if (preferred) return preferredSelection(item, ladder, { ...context, preferred });
	const plan = claude
		? claudeRoute(item, ladder, restrictions.length > 0)
		: { steps: eligibleLadder(route, ladder, restrictions.length > 0), why: '' };
	const { index, why } = adjustByHistory(plan.steps, history, cfg?.autolaunch?.learning);
	const rung = plan.steps[index];
	const effort = rung.id === 'sol' ? solEffort(kind, size) : rung.effort;
	const label = claude ? `${rung.id} ${effort}` : rung.id;
	const window = claude ? [plan.why, 'Claude only until the Codex reset, 27 Nov 10:39 Lisbon'] : [];
	return {
		rung: { ...rung, effort },
		kind,
		reason: [`${kind}/${size}: ${label}`, ...window, ...why].join('; ')
	};
}

function raisedPinReason(
	item: TrackerModelItem,
	rung: TrackerModelRung,
	{ route, restrictions, claude }: PinContext
) {
	const haiku = /haiku/i.test(`${rung.id} ${rung.model}`);
	if (haiku || rung.id === 'luna') {
		if (restrictions.length) return restrictions.join(', ');
		if (route === 'live-deploy') return 'preprod or production deployment';
	}
	// Before the Codex reset Haiku is a normal choice for tests, docs and checks.
	if (!claude && haiku && route !== 'visual' && !isHarnessModule(item))
		return 'Haiku is reserved for visual and Harness module work';
	return null;
}

export function retryTrackerModel(
	item: TrackerModelItem,
	run: TrackerRetryRun,
	options: TrackerRetryOptions = {}
): TrackerModelRung {
	if (run.pinned)
		return pickTrackerModel({ ...item, model: `${run.model}:${run.effort ?? ''}` }, options).rung;
	const restricted = floorReasons(item).length > 0;
	const ladder = ladderFrom(options.cfg);
	const claudeSteps = retryClaudeRoute(options);
	if (claudeSteps) return nextClaudeRung(claudeSteps(item, ladder, restricted), run);
	return nextEligibleRung(item, eligibleLadder(trackerTaskRoute(item), ladder, restricted), run);
}

function nextEligibleRung(
	item: TrackerModelItem,
	eligible: TrackerModelRung[],
	run: TrackerRetryRun
): TrackerModelRung {
	const previous = run.rung === 'sol-xhigh' ? 'sol' : run.rung;
	const index = eligible.findIndex(({ id }) => id === previous);
	const rung = eligible[Math.min(index + 1, eligible.length - 1)];
	if (rung.id !== 'sol') return rung;
	const current = solEfforts.indexOf(run.effort ?? '');
	const effort =
		previous === 'sol' && current >= 0
			? (solEfforts[current + 1] ?? 'xhigh')
			: solEffort(classifyTrackerTask(item), sizeOf(item));
	return { ...rung, effort };
}

// The Claude table a retry climbs, when the preference or the reset window sends it to Claude.
function retryClaudeRoute(options: TrackerRetryOptions) {
	if (activePreferenceEnd(options.claudePreferredUntil, options.now)) return preferredClaudeRoute;
	return claudeOnly(options) ? claudeRoute : undefined;
}

// Automatic selection starts at its eligibility floor. Learning can only move up.
function adjustByHistory(
	ladder: readonly TrackerModelRung[],
	history?: TrackerModelHistory,
	{ minSamples = 3, upBelow = 0.5 }: TrackerLearningConfig = {}
) {
	const why: string[] = [];
	let index = 0;
	for (; index < ladder.length - 1; index++) {
		const rung = ladder[index];
		const counts = history?.[rung.id];
		if (!counts || counts.ok + counts.fail < minSamples) break;
		const rate = counts.ok / (counts.ok + counts.fail);
		if (!(rate < upBelow)) break;
		why.push(`${rung.id} succeeded ${Math.round(rate * 100)}% on similar tasks`);
	}
	return { index, why: [...new Set(why)] };
}
