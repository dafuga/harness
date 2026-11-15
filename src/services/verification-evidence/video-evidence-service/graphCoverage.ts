// @harness-uid u_nfctcgnv7g
import type { VideoManifest } from '../../../utils/verification-evidence/videoClipSchema.types';
import type { VideoObservation, VideoGraphCoverage } from '../VideoEvidenceService.types';

/** A finite graph is complete only when every required viewport proves all states and edges. */
export function graphCoverage(
	manifest: VideoManifest,
	observations: VideoObservation[]
): VideoGraphCoverage[] {
	return manifest.graphs.map((graph) => {
		const clips = manifest.clips.filter((clip) => graph.clips.includes(clip.id));
		const viewports = [...new Set(clips.flatMap((clip) => clip.viewports))];
		const required = viewports.flatMap((viewport) => [
			...graph.states.map((state) => `${viewport}/state/${state.id}`),
			...graph.edges.map((edge) => `${viewport}/edge/${edge.id}`),
			...clips
				.filter((clip) => clip.viewports.includes(viewport))
				.map((clip) => `${viewport}/clip/${clip.id}`)
		]);
		const covered = observationSlots(clips, observations);
		const missing = required.filter((slot) => !covered.has(slot));
		const ratio = (kind: string) => {
			const slots = required.filter((slot) => slot.includes(`/${kind}/`));
			return slots.length ? slots.filter((slot) => covered.has(slot)).length / slots.length : 1;
		};
		return {
			graph: graph.id,
			states: ratio('state'),
			edges: ratio('edge'),
			complete: viewports.length > 0 && missing.length === 0,
			missing
		};
	});
}

function observationSlots(
	clips: VideoManifest['clips'],
	observations: VideoObservation[]
): Set<string> {
	const covered = new Set<string>();
	for (const observation of observations) {
		const clip = clips.find((candidate) => candidate.id === observation.clipId);
		if (!clip || !validObservation(clip, observation)) continue;
		covered.add(`${observation.viewport}/clip/${clip.id}`);
		for (const [kind, visits, ids] of [
			['state', observation.states, clip.states],
			['edge', observation.edges, clip.edges]
		] as const) {
			for (const visit of visits.filter(
				(visit) =>
					ids.includes(visit.id) &&
					visit.atSeconds >= 0 &&
					visit.atSeconds <= observation.durationSeconds
			))
				covered.add(`${observation.viewport}/${kind}/${visit.id}`);
		}
	}
	return covered;
}
function validObservation(
	clip: VideoManifest['clips'][number],
	observation: VideoObservation
): boolean {
	return (
		observation.fresh !== false &&
		clip.viewports.includes(observation.viewport) &&
		observation.durationSeconds > 0 &&
		observation.durationSeconds <= clip.durationSeconds
	);
}
