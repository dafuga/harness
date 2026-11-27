// @harness-uid u_gs5pnxnxt4
import { ladderFrom, parseTrackerModelSpec, solEfforts } from './parseTrackerModelSpec';
import { adjustTrackerModelByHistory } from './adjustTrackerModelByHistory';
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
import type { TrackerLadderConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type {
	ClaudeRoute,
	PinContext,
	SelectionContext,
	TrackerModelSelection,
	TrackerModelSelectionOptions,
	TrackerRetryRun
} from './pickTrackerModel.types';
import type { TrackerModelItem, TrackerTaskRoute } from './classifyTrackerTask.types';
import { resolvePreferredProvider } from './resolvePreferredProvider';

// Codex's weekly limit resets 27 Nov 2026 10:39 Europe/Lisbon (UTC+0 in November).
const codexResetAt = Date.parse('2026-11-27T10:39:00Z');
const windowNote = 'Claude only until the Codex reset, 27 Nov 10:39 Lisbon';

function claudeOnly({ cfg, now }: { cfg?: TrackerLadderConfig; now?: number }) {
	const until = Date.parse(cfg?.autolaunch?.claudeOnlyUntil ?? '');
	return (now ?? Date.now()) < (Number.isNaN(until) ? codexResetAt : until);
}

function providerPreference(cfg?: TrackerLadderConfig, now = Date.now()) {
	const preference = cfg?.autolaunch?.preferredProvider;
	return preference && resolvePreferredProvider(preference, now);
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
	const context = selectionContext(item, options);
	return item.model
		? pinnedSelection(item, ladder, context)
		: automaticSelection(item, ladder, context, options);
}

function selectionContext(item: TrackerModelItem, options: TrackerModelSelectionOptions) {
	const preference = providerPreference(options.cfg, options.now);
	return {
		kind: classifyTrackerTask(item),
		size: sizeOf(item),
		route: trackerTaskRoute(item),
		restrictions: floorReasons(item),
		claude: preference ? preference.provider === 'claude' : claudeOnly(options),
		preferenceReason: preference?.why
	};
}

function pinnedSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext
): TrackerModelSelection {
	const { kind, size, route, claude } = context;
	const rung = parseTrackerModelSpec(item.model ?? '', ladder);
	const raised = context.preferenceReason ? null : raisedPinReason(item, rung, context);
	if (!raised) return { rung, kind, reason: `named on the item (${item.model})` };
	const replacement = claude
		? claudeRoute(item, ladder, true).steps[0]
		: eligibleLadder(route === 'live-deploy' ? route : 'default', ladder, true)[0];
	const name = { opus: 'Opus', sonnet: 'Sonnet' }[replacement.id] ?? 'Sol';
	const effort = replacement.id === 'sol' ? solEffort(kind, size) : replacement.effort;
	return {
		rung: { ...replacement, effort, pinned: true },
		kind,
		reason: `named ${item.model}, raised to ${name} (${raised})`
	};
}

function automaticSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext,
	{ cfg, history }: TrackerModelSelectionOptions
): TrackerModelSelection {
	const { kind, size, claude, preferenceReason } = context;
	const plan = automaticRoute(item, ladder, context);
	const { index, why } = adjustTrackerModelByHistory(
		plan.steps,
		history,
		cfg?.autolaunch?.learning
	);
	const rung = plan.steps[index];
	const effort = rung.id === 'sol' ? initialSolEffort(kind, size, preferenceReason) : rung.effort;
	const label = claude || preferenceReason ? `${rung.id} ${effort}` : rung.id;
	return {
		rung: { ...rung, effort },
		kind,
		reason: [`${kind}/${size}: ${label}`, ...plan.reasons, ...why].join('; ')
	};
}

function automaticRoute(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext
) {
	const { claude, route, preferenceReason, restrictions } = context;
	const restricted = restrictions.length > 0;
	if (claude) {
		const { steps, why } = claudeRoute(item, ladder, restricted);
		return { steps, reasons: [why, preferenceReason ?? windowNote] };
	}
	const reasons = preferenceReason ? [preferenceReason] : [];
	if (preferenceReason && route === 'live-deploy') reasons.push('deploy: Opus high');
	return { steps: eligibleLadder(route, ladder, restricted), reasons };
}

function initialSolEffort(
	kind: SelectionContext['kind'],
	size: SelectionContext['size'],
	preference?: string
) {
	return preference && kind === 'hard' && size === 'large' ? 'xhigh' : solEffort(kind, size);
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
	cfg?: TrackerLadderConfig,
	now?: number
): TrackerModelRung {
	const context = selectionContext(item, { cfg, now });
	const pin = context.preferenceReason ? item.model : undefined;
	const model = pin ?? (run.pinned ? `${run.model}:${run.effort ?? ''}` : undefined);
	if (model) return pickTrackerModel({ ...item, model }, { cfg, now }).rung;
	const { steps } = automaticRoute(item, ladderFrom(cfg), context);
	return context.claude ? nextClaudeRung(steps, run) : nextCodexRung(steps, run, context);
}

function nextCodexRung(
	eligible: TrackerModelRung[],
	run: TrackerRetryRun,
	context: SelectionContext
) {
	const previous = run.rung === 'sol-xhigh' ? 'sol' : run.rung;
	const index = eligible.findIndex(({ id }) => id === previous);
	const rung = eligible[Math.min(index + 1, eligible.length - 1)];
	if (rung.id !== 'sol') return rung;
	const current = solEfforts.indexOf(run.effort ?? '');
	const effort =
		previous === 'sol' && current >= 0
			? (solEfforts[current + 1] ?? 'xhigh')
			: initialSolEffort(context.kind, context.size, context.preferenceReason);
	return { ...rung, effort };
}

// A failed Claude rung moves to the next step of its route; an unknown rung restarts at the first.
function nextClaudeRung(steps: TrackerModelRung[], run: TrackerRetryRun) {
	const exact = steps.findIndex((step) => step.id === run.rung && step.effort === run.effort);
	const found = exact >= 0 ? exact : steps.map(({ id }) => id).lastIndexOf(run.rung);
	return steps[Math.min(found + 1, steps.length - 1)];
}
