// @harness-uid u_7qp73gyvnu
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import { fail } from '../../../../core/development-tooling/errors';

/** The statement every scoped record carries, so it is never read as a full pass. */
export function scopeFailure(entity: string): string {
	return `Scoped to ${entity}: only its scenario states ran, so this record is partial and never a full pass.`;
}

/**
 * The scenarios that cover one entity, each narrowed to the states that show it, so its coverage
 * asks only for that entity's captures. An entity no state names is shown by the states that name
 * nothing, which stand for the whole scenario; a state naming other units never shows it. An
 * entity no scenario covers is refused.
 */
export function scopedScenarios(scenarios: ScenarioManifest[], entity: string): ScenarioManifest[] {
	const covering = scenarios.filter((scenario) => scenario.units.includes(entity));
	if (covering.length === 0) fail(`No scenario covers ${entity}; nothing can be verified for it.`);
	return covering.map((scenario) => {
		const explicit = scenario.states.some((state) => (state.units ?? []).includes(entity));
		const states = explicit
			? scenario.states.filter((state) => (state.units ?? []).includes(entity))
			: scenario.states.filter((state) => !state.units?.length);
		const shown = new Set(states.map((state) => state.id));
		const video = scenario.video ? scopedVideo(scenario.video, entity, shown) : undefined;
		const videoStates = new Set(video?.clips.map((clip) => clip.state));
		return {
			...scenario,
			units: [entity],
			states,
			...(video ? { video } : {}),
			evidence: (scenario.evidence ?? []).map((item) => ({
				...item,
				states: item.states.filter(
					(state) => shown.has(state) && (item.kind !== 'video' || !video || videoStates.has(state))
				)
			}))
		};
	});
}

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The component catalog names tests by entity; page scenarios keep their own test names. */
export function scopedCheck(check: PlannedCheck, entity: string): PlannedCheck {
	const playwright = check.runner === 'playwright' || /\bplaywright test\b/.test(check.command);
	const selected = /(?:^|\s)(?:--grep|-g)(?:\s|=)/.test(check.command);
	if (check.scenario !== 'component-catalog-previews' || !playwright || selected) return check;
	const grep = `(^| )${escaped(entity)}(:[^ ]+)? at `;
	return { ...check, command: `${check.command} --grep '${grep}'` };
}

function scopedVideo(
	video: NonNullable<ScenarioManifest['video']>,
	entity: string,
	shown: Set<string>
) {
	const clips = video.clips.filter((clip) => clip.unit === entity && shown.has(clip.state));
	const selected = new Set(clips.map((clip) => clip.id));
	return {
		...video,
		clips,
		graphs: video.graphs
			.filter((graph) => graph.unit === entity && graph.clips.some((id) => selected.has(id)))
			.map((graph) => ({ ...graph, clips: graph.clips.filter((id) => selected.has(id)) })),
		playlists: video.playlists
			.map((playlist) => ({ ...playlist, clips: playlist.clips.filter((id) => selected.has(id)) }))
			.filter((playlist) => playlist.clips.length)
	};
}
