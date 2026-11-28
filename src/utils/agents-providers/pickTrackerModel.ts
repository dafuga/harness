// @harness-uid u_gs5pnxnxt4
import { ladderFrom, parseTrackerModelSpec } from './parseTrackerModelSpec';
import {
	classifyTrackerTask,
	floorReasons,
	isHarnessModule,
	sizeOf,
	solEffort,
	trackerTaskRoute
} from './classifyTrackerTask';
import {
	activePreferenceEnd,
	claudePreferenceNote,
	switchedSelection
} from './preferredClaudeRoute';
import type {
	TrackerLadderConfig,
	TrackerLearningConfig,
	TrackerModelRung
} from './parseTrackerModelSpec.types';
import type {
	ClaudeRoute,
	TrackerModelHistory,
	PinContext,
	SelectionContext,
	TrackerModelSelection,
	TrackerModelSelectionOptions
} from './pickTrackerModel.types';
import type { TrackerModelItem } from './classifyTrackerTask.types';
import { climbedStep, hardEscalation } from './trackerEscalation';
import { explicitModelSelection } from './trackerExplicitModel';
import { trackerModelRoute } from './trackerModelRoute';
import { trackerTaskType } from './trackerTaskType';

const codexResetAt = Date.parse('2026-11-27T10:39:00Z');
const resetWindowNote = 'Claude only until the Codex reset, 27 Nov 10:39 Lisbon';

function claudeOnly({ cfg, now }: { cfg?: TrackerLadderConfig; now?: number }) {
	const until = Date.parse(cfg?.autolaunch?.claudeOnlyUntil ?? '');
	return (now ?? Date.now()) < (Number.isNaN(until) ? codexResetAt : until);
}

/** Everything a route depends on, read once for a pick, a retry or a redirect. */
export function trackerSelectionContext(
	item: TrackerModelItem,
	options: TrackerModelSelectionOptions
): SelectionContext {
	const preferred = activePreferenceEnd(options.claudePreferredUntil, options.now);
	return {
		preferred,
		kind: classifyTrackerTask(item),
		size: sizeOf(item),
		route: trackerTaskRoute(item),
		restrictions: floorReasons(item),
		claude: Boolean(preferred) || claudeOnly(options),
		cfg: options.cfg
	};
}

export function pickTrackerModel(
	item: TrackerModelItem,
	options: TrackerModelSelectionOptions = {}
): TrackerModelSelection {
	const ladder = ladderFrom(options.cfg);
	const context = trackerSelectionContext(item, options);
	const taskType = trackerTaskType(item);
	const selection =
		explicitModelSelection(item, ladder, context.kind) ??
		(item.model
			? pinnedSelection(item, ladder, context)
			: automaticSelection(item, ladder, context, options));
	return { ...selection, taskType };
}

// A model saved on the item before --model choices were recorded.
function pinnedSelection(
	item: TrackerModelItem,
	ladder: TrackerModelRung[],
	context: SelectionContext
) {
	const { kind, size, preferred, cfg } = context;
	const rung = parseTrackerModelSpec(item.model ?? '', ladder);
	if (preferred && rung.cli === 'codex' && trackerTaskType(item) !== 'computer-use')
		return switchedSelection(item, ladder, { kind, until: preferred, cfg });
	const raised = raisedPinReason(item, rung, context);
	if (!raised) return { rung, kind, reason: `named on the item (${item.model})` };
	const replacement = trackerModelRoute(item, ladder, {
		...context,
		restrictions: [raised]
	}).steps[0];
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
	{ cfg, history, evidence }: TrackerModelSelectionOptions
) {
	const { kind, size, claude, preferred } = context;
	const plan = trackerModelRoute(item, ladder, context);
	const learned = preferred ? { index: 0, why: [] } : adjustByHistory(plan.steps, history, cfg);
	const climbed = climbedStep(plan.steps, evidence);
	const step = plan.steps[Math.max(learned.index, climbed)];
	const notes = climbed > learned.index ? ['climbed past failed attempts on this item'] : [];
	const escalation =
		trackerTaskType(item) === 'computer-use'
			? undefined
			: hardEscalation(evidence, { ladder, cfg, claudeOnly: claude });
	const rung = escalation?.rung ?? step;
	const label = claude ? `${rung.id} ${rung.effort}` : rung.id;
	const why = [...learned.why, ...notes, escalation?.why];
	return {
		rung: { ...rung },
		kind,
		reason: [`${kind}/${size}: ${label}`, ...routeNotes(plan, context), ...why]
			.filter(Boolean)
			.join('; ')
	};
}

function routeNotes({ why }: ClaudeRoute, { claude, preferred }: SelectionContext) {
	if (preferred) return [why, claudePreferenceNote(preferred)];
	return [why, claude ? resetWindowNote : ''];
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

// Automatic selection starts at its eligibility floor. Learning can only move up.
function adjustByHistory(
	ladder: readonly TrackerModelRung[],
	history?: TrackerModelHistory,
	cfg?: TrackerLadderConfig
) {
	const why: string[] = [];
	let index = 0;
	for (;;) {
		const { id } = ladder[index];
		// Further efforts of the same model share its record, so learning moves to the next model.
		const next = ladder.findIndex((step, at) => at > index && step.id !== id);
		const poor = next < 0 ? undefined : poorSuccess(history?.[id], cfg?.autolaunch?.learning);
		if (poor === undefined) break;
		why.push(`${id} succeeded ${Math.round(poor * 100)}% on similar tasks`);
		index = next;
	}
	return { index, why };
}

/** The success rate that is low enough to move up, if there are enough samples to say so. */
function poorSuccess(
	counts: TrackerModelHistory[string],
	{ minSamples = 3, upBelow = 0.5 }: TrackerLearningConfig = {}
) {
	if (!counts || counts.ok + counts.fail < minSamples) return undefined;
	const rate = counts.ok / (counts.ok + counts.fail);
	return rate < upBelow ? rate : undefined;
}
