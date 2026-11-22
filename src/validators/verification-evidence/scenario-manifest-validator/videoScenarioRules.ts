// @harness-uid u_hfud4vng54
import type { ScenarioManifest } from '../../../core/development-tooling/unitTypes';

/** Enrollment is explicit; historical scenarios have no new motion obligations. */
export function videoScenarioRules(scenario: ScenarioManifest): string[] {
	if (!scenario.video) return [];
	return [...motionRules(scenario), ...clipRules(scenario), ...viewportRules(scenario)];
}

function motionRules(scenario: ScenarioManifest): string[] {
	return scenario.states
		.filter((state) => state.coverage === 'required')
		.flatMap((state) => {
			if (!state.motion)
				return [`${scenario.id}: enrolled state ${state.id} must declare motion required or none`];
			if (state.motion === 'none')
				return state.motionReason?.trim()
					? []
					: [`${scenario.id}: motion none state ${state.id} must give a motionReason`];
			const clips = scenario.video!.clips.filter((clip) => clip.state === state.id);
			return scenario.viewports
				.filter((viewport) => !clips.some((clip) => clip.viewports.includes(viewport.id)))
				.map(
					(viewport) =>
						`${scenario.id}: moving state ${state.id} has no video clip at ${viewport.id}`
				);
		});
}

function clipRules(scenario: ScenarioManifest): string[] {
	return scenario.video!.clips.flatMap((clip) => {
		const state = scenario.states.find((state) => state.id === clip.state);
		if (state?.coverage !== 'required')
			return [`${scenario.id}: clip ${clip.id} must bind a required scenario state`];
		const explicit = scenario.states.some((state) => state.units?.includes(clip.unit));
		const shown = explicit ? state.units?.includes(clip.unit) : !state.units?.length;
		const errors =
			scenario.units.includes(clip.unit) && shown
				? []
				: [`${scenario.id}: clip ${clip.id} owner ${clip.unit} is outside its state attribution`];
		for (const viewport of clip.viewports) {
			const evidence = scenario.evidence.some(
				(item) =>
					item.kind === 'video' &&
					item.required &&
					item.states.includes(state.id) &&
					item.viewports.includes(viewport)
			);
			if (!evidence)
				errors.push(
					`${scenario.id}: clip ${clip.id} needs required video evidence for ${state.id} at ${viewport}`
				);
		}
		return errors;
	});
}

function viewportRules(scenario: ScenarioManifest): string[] {
	return scenario.video!.viewports.flatMap((viewport) => {
		const declared = scenario.viewports.find((item) => item.id === viewport.id);
		const same =
			declared?.width === viewport.width &&
			declared.height === viewport.height &&
			(declared.scale ?? 1) === (viewport.scale ?? 1);
		return same
			? []
			: [`${scenario.id}: video viewport ${viewport.id} dimensions must match the scenario`];
	});
}
