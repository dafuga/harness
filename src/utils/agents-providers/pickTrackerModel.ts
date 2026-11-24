// @harness-uid u_gs5pnxnxt4
import { ladderFrom, parseTrackerModelSpec, solEfforts } from './parseTrackerModelSpec';
import {
	classifyTrackerTask,
	floorReasons,
	isHarnessModule,
	sizeOf,
	solEffort,
	trackerTaskRoute
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
import type { TrackerModelItem, TrackerTaskRoute } from './classifyTrackerTask.types';

function eligibleLadder(route: TrackerTaskRoute, ladder: TrackerModelRung[], restricted: boolean) {
	const [haiku, sonnet, terra, sol, opus] = ladder;
	switch (route) {
		case 'live-deploy':
			return [opus];
		case 'computer-use':
			return restricted ? [sol] : [terra, sol];
		case 'visual':
			return restricted ? [sonnet] : [haiku, sonnet];
		default:
			return [sol];
	}
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
	const route = trackerTaskRoute(item);
	if (item.model) {
		const rung = parseTrackerModelSpec(item.model, ladder);
		const raised = raisedPinReason(item, rung, route, restrictions);
		if (raised) {
			const replacement =
				route === 'live-deploy'
					? eligibleLadder(route, ladder, true)[0]
					: eligibleLadder('default', ladder, true)[0];
			return {
				rung: {
					...replacement,
					effort: replacement.id === 'sol' ? solEffort(kind, size) : replacement.effort,
					pinned: true
				},
				kind,
				reason: `named ${item.model}, raised to ${replacement.id === 'opus' ? 'Opus' : 'Sol'} (${raised})`
			};
		}
		return { rung, kind, reason: `named on the item (${item.model})` };
	}
	const eligible = eligibleLadder(route, ladder, restrictions.length > 0);
	const { index, why } = adjustByHistory(eligible, history, cfg?.autolaunch?.learning);
	const rung = eligible[index];
	const effort = rung.id === 'sol' ? solEffort(kind, size) : rung.effort;
	return {
		rung: { ...rung, effort },
		kind,
		reason: [`${kind}/${size}: ${rung.id}`, ...why].join('; ')
	};
}

function raisedPinReason(
	item: TrackerModelItem,
	rung: TrackerModelRung,
	route: TrackerTaskRoute,
	restrictions: string[]
) {
	const haiku = /haiku/i.test(`${rung.id} ${rung.model}`);
	if (haiku || rung.id === 'luna') {
		if (restrictions.length) return restrictions.join(', ');
		if (route === 'live-deploy') return 'preprod or production deployment';
	}
	if (haiku && route !== 'visual' && !isHarnessModule(item))
		return 'Haiku is reserved for visual and Harness module work';
	return null;
}

export function retryTrackerModel(
	item: TrackerModelItem,
	run: TrackerRetryRun,
	cfg?: TrackerLadderConfig
): TrackerModelRung {
	if (run.pinned)
		return pickTrackerModel({ ...item, model: `${run.model}:${run.effort ?? ''}` }, { cfg }).rung;
	const eligible = eligibleLadder(
		trackerTaskRoute(item),
		ladderFrom(cfg),
		floorReasons(item).length > 0
	);
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
	return { index, why };
}
