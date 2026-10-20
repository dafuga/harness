import type { ComponentManifest, ScenarioManifest } from '../core/unitTypes';

type PreviewUnit = Pick<ComponentManifest, 'id' | 'scenarios' | 'preview'>;

function stateFor(unit: PreviewUnit, scenario: ScenarioManifest, id: string) {
	const state = scenario.states.find((item) => item.id === id);
	const covers = scenario.units.includes(unit.id) || unit.scenarios.includes(scenario.id);
	if (!covers || !state) return null;
	const named = scenario.states.some((item) => item.units?.includes(unit.id));
	return named && !state.units?.includes(unit.id) ? null : state;
}

/** A declared preview may select only the unit's own required screenshot state and viewport. */
export function previewBinding(unit: PreviewUnit, scenarios: ScenarioManifest[]): string[] {
	const preview = unit.preview;
	if (!preview) return [];
	const scenario = scenarios.find((item) => item.id === preview.scenario);
	if (!scenario) return [`${unit.id}: unknown preview scenario ${preview.scenario}`];
	const state = stateFor(unit, scenario, preview.state);
	if (!state) return [`${unit.id}: preview state ${preview.state} does not show ${unit.id}`];
	const shot = scenario.evidence.some(
		(item) =>
			item.required &&
			item.kind === 'screenshot' &&
			item.states.includes(state.id) &&
			item.viewports.includes(preview.viewport)
	);
	if (
		state.coverage !== 'required' ||
		!shot ||
		!scenario.viewports.some((item) => item.id === preview.viewport)
	)
		return [
			`${unit.id}: preview state ${state.id} has no required screenshot at ${preview.viewport}`
		];
	return [];
}
