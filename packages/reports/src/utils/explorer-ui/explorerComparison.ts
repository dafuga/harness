// @harness-uid u_qxfvd3jaxh
import type { Named } from './explorerEvidence.types';
import type { ExplorerSide } from '../../models/explorer-ui/Explorer.types';
import type { HarnessRevision, HarnessScenario } from '../../models/explorer-ui/Harness.types';
import { scenarioFor } from './explorerState';

/** The scenarios that cover a unit, each with the states that show that unit. */
export const covering = (detail: HarnessRevision | null, unit: string) =>
	(detail?.registry.scenarios ?? [])
		.filter((item) => item.units.includes(unit))
		.map((item) => scenarioFor(item, unit, detail?.registry.units));

/** The entries of both lists, each id once: those of the first, then what only the second has. */
export function united<Item extends Named>(now: Item[], was: Item[]): Item[] {
	return [...now, ...was.filter((item) => !now.some((found) => found.id === item.id))];
}

/** A scenario as both sides declare it, so a state or a viewport one side dropped stays. */
export function merged(now: HarnessScenario, was: HarnessScenario | undefined): HarnessScenario {
	if (!was) return now;
	return {
		...now,
		states: united(now.states, was.states),
		viewports: united(now.viewports, was.viewports),
		evidence: united(now.evidence ?? [], was.evidence ?? [])
	};
}

/** Why one scenario is not the same run on both sides: its viewport sizes or its tests differ. */
function redefined(now: HarnessScenario, was: HarnessScenario): string[] {
	const sizes = now.viewports.flatMap((viewport) => {
		const before = was.viewports.find((item) => item.id === viewport.id);
		const same = !before || (before.width === viewport.width && before.height === viewport.height);
		const [old, next] = [before, viewport].map((item) => `${item?.width}×${item?.height}`);
		return same
			? []
			: [`${now.title}: viewport ${viewport.id} is ${old} before and ${next} after.`];
	});
	const tests = JSON.stringify(now.tests) === JSON.stringify(was.tests);
	return tests ? sizes : [...sizes, `${now.title} runs other tests after than before.`];
}

/** Why the two sides are not like for like; empty when they are, as far as the history records. */
export function explorerComparison(
	before: ExplorerSide,
	after: ExplorerSide,
	unit: string
): string[] {
	const profiles = [before.record?.profile, after.record?.profile];
	const differ = profiles[0] && profiles[1] && profiles[0] !== profiles[1];
	const earlier = covering(before.detail, unit);
	const scenarios = covering(after.detail, unit).flatMap((now) => {
		const was = earlier.find((item) => item.id === now.id);
		return was ? redefined(now, was) : [];
	});
	const profile = `The two sides were recorded under different profiles (${profiles.join(' and ')}).`;
	return differ ? [profile, ...scenarios] : scenarios;
}
