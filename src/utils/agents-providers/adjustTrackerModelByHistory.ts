// @harness-uid u_wz3242lk7p
import type { TrackerLearningConfig, TrackerModelRung } from './parseTrackerModelSpec.types';
import type { TrackerModelHistory } from './pickTrackerModel.types';

/** Automatic selection starts at its eligibility floor. Learning can only move up. */
export function adjustTrackerModelByHistory(
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
