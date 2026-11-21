// @harness-uid u_gs5pnxnxt4
import { ladderFrom, parseTrackerModelSpec, solEfforts } from './parseTrackerModelSpec';
import {
	classifyTrackerTask,
	floorReasons,
	isHarnessModule,
	isVisualInspection,
	projectOf,
	sizeOf,
	solEffort
} from './classifyTrackerTask';
import type {
	TrackerLadderConfig,
	TrackerLearningConfig,
	TrackerModelRung
} from './parseTrackerModelSpec.types';
import type {
	TrackerModelHistory,
	TrackerModelSelection,
	TrackerModelSelectionOptions,
	TrackerRetryRun
} from './pickTrackerModel.types';
import type { TrackerModelItem } from './classifyTrackerTask.types';

function eligibleLadder(item: TrackerModelItem, ladder: TrackerModelRung[], restricted: boolean) {
	const haiku = !restricted && isHarnessModule(item);
	const terra = !restricted && isVisualInspection(item);
	return ladder.filter((rung) => rung.id === 'sol' || (rung.id === 'haiku' ? haiku : terra));
}

export function pickTrackerModel(
	item: TrackerModelItem,
	options: TrackerModelSelectionOptions = {}
): TrackerModelSelection {
	const { cfg, history } = options;
	const ladder = ladderFrom(cfg);
	const kind = classifyTrackerTask(item);
	const size = sizeOf(item);
	const restrictions = floorReasons(item);
	if (item.model) {
		const rung = parseTrackerModelSpec(item.model, ladder, projectOf(item), cfg);
		const raised = raisedPinReason(item, rung, restrictions);
		if (raised) {
			const sol = ladder.at(-1)!;
			return {
				rung: { ...sol, effort: solEffort(kind, size), pinned: true },
				kind,
				reason: `named ${item.model}, raised to Sol (${raised})`
			};
		}
		return { rung, kind, reason: `named on the item (${item.model})` };
	}
	const eligible = eligibleLadder(item, ladder, restrictions.length > 0);
	const start = size === 'large' ? eligible.length - 1 : 0;
	const { index, why } = adjustByHistory(start, eligible, history, cfg?.autolaunch?.learning);
	const rung = eligible[index];
	const effort = rung.id === 'sol' ? solEffort(kind, size) : rung.effort;
	return {
		rung: { ...rung, effort },
		kind,
		reason: [`${kind}/${size}: ${rung.id}`, ...why].join('; ')
	};
}

function raisedPinReason(item: TrackerModelItem, rung: TrackerModelRung, restrictions: string[]) {
	const haiku = /haiku/i.test(`${rung.id} ${rung.model}`);
	if (restrictions.length && (haiku || rung.id === 'luna')) return restrictions.join(', ');
	if (haiku && !isHarnessModule(item)) return 'Haiku is reserved for Harness module work';
	return null;
}

export function retryTrackerModel(
	item: TrackerModelItem,
	run: TrackerRetryRun,
	cfg?: TrackerLadderConfig
): TrackerModelRung {
	if (run.pinned)
		return pickTrackerModel({ ...item, model: `${run.model}:${run.effort ?? ''}` }, { cfg }).rung;
	const sol = ladderFrom(cfg).at(-1)!;
	const current = solEfforts.indexOf(run.effort ?? '');
	const alreadySol = run.rung === 'sol' || run.rung === 'sol-xhigh';
	const effort =
		alreadySol && current >= 0
			? solEfforts[current + 1]
			: solEffort(classifyTrackerTask(item), sizeOf(item));
	return { ...sol, effort: effort || 'xhigh' };
}

// Automatic selection starts at its eligibility floor. Learning can only move up.
function adjustByHistory(
	start: number,
	ladder: readonly TrackerModelRung[],
	history?: TrackerModelHistory,
	{ minSamples = 3, upBelow = 0.5 }: TrackerLearningConfig = {}
) {
	const why: string[] = [];
	let index = start;
	for (; index < ladder.length - 1; index++) {
		const rung = ladder[index];
		const counts = history?.[rung.id];
		if (!counts || counts.ok + counts.fail < minSamples) break;
		const rate = counts.ok / (counts.ok + counts.fail);
		if (!(rate < upBelow)) break;
		why.push(`${rung.id} succeeded ${Math.round(rate * 100)}% on similar tasks`);
	}
	return { index, why };
}
