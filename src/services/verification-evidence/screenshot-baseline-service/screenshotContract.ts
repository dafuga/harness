import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import {
	componentManifestSchema,
	scenarioManifestSchema,
	type ComponentManifest,
	type ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import { fail } from '../../../core/development-tooling/errors';
import type { ScreenshotContract, ScreenshotReviewInput } from './ScreenshotBaselineService.types';

/** Read the case and evidence slot from the tested commit, never from the working tree. */
export async function screenshotContract(
	root: string,
	input: ScreenshotReviewInput
): Promise<ScreenshotContract> {
	const tree = await CommitTreeAdapter.open(root, input.commit);
	const unit = componentManifestSchema.parse(
		JSON.parse(await tree.read(`specification/units/${input.unit}.json`))
	);
	const scenario = scenarioManifestSchema.parse(
		JSON.parse(await tree.read(`specification/scenarios/${input.scenario}.json`))
	);
	const selected = visualCase(unit, input);
	const slot = visualSlot(scenario, input, selected.state);
	const viewport = scenario.viewports.find((entry) => entry.id === input.viewport);
	if (!viewport) return fail('Baseline viewport is not declared by the scenario.');
	const checks = scenario.tests
		.filter((test) => test.cases?.some((ref) => ref.unit === unit.id && ref.case === input.case))
		.map((test) => test.id);
	if (!checks.length) return fail('Baseline case is not executed by the scenario.');
	return {
		...selected,
		build: slot.build,
		checks,
		viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale ?? 1 },
		mode: slot.capture ?? 'viewport'
	};
}

function visualCase(unit: ComponentManifest, input: ScreenshotReviewInput) {
	assertVisualUnit(unit, input.unit);
	const cases = unit.testing!.cases.filter((item) => item.id === input.case);
	const item = cases.length === 1 ? cases[0] : undefined;
	if (!item || item.expected?.kind !== 'screenshot' || !item.viewports?.includes(input.viewport))
		return fail('Baseline case or viewport is not declared.');
	return {
		state: item.state,
		file: item.expected.file,
		testFile: item.test.file,
		testTitle: item.test.title
	};
}

function assertVisualUnit(unit: ComponentManifest, expected: string): void {
	if (unit.id !== expected || unit.status !== 'active') fail('Baseline unit is not active.');
	if (!['page', 'component'].includes(unit.testing?.shape ?? ''))
		fail('Baseline requires a declared visual test contract.');
}

function visualSlot(scenario: ScenarioManifest, input: ScreenshotReviewInput, stateId: string) {
	const state = scenario.states.find((entry) => entry.id === stateId);
	if (
		!scenario.units.includes(input.unit) ||
		state?.coverage !== 'required' ||
		!(state.units ?? scenario.units).includes(input.unit)
	)
		return fail('Baseline state does not cover the unit.');
	const matches = scenario.evidence.filter(
		(entry) =>
			entry.id === input.evidence &&
			entry.kind === 'screenshot' &&
			entry.required &&
			entry.provenance === 'actual-capture' &&
			entry.states.includes(stateId) &&
			entry.viewports.includes(input.viewport)
	);
	const slot = matches.length === 1 ? matches[0] : undefined;
	if (!slot?.build) return fail('Baseline evidence needs one declared actual capture and build.');
	return { build: slot.build, capture: slot.capture };
}
