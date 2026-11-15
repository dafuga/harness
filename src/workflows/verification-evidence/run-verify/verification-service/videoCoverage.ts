// @harness-uid u_lnqhwcablp
import { videoFlagCoverageFailure } from './videoFlagCoverage';
import type { VideoCoverageReport } from './videoCoverage.types';
import type { CoverageInput } from '../../../../utils/verification-evidence/scenarioCoverage.types';
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';
import type { VideoClip } from '../../../../utils/verification-evidence/videoClipSchema.types';
import type { VideoObservation } from '../../../../services/verification-evidence/VideoEvidenceService.types';
import { VideoEvidenceService } from '../../../../services/verification-evidence/VideoEvidenceService';

/** Enrollment adds a completeness gate; unenrolled historical scenarios keep their own rules. */
export function videoCoverageFailures(input: CoverageInput, admitted: Gathered[]): string[] {
	return videoCoverageReport(input, admitted).failures;
}

export function videoCoverageReport(
	input: CoverageInput,
	admitted: Gathered[]
): VideoCoverageReport {
	const declaration = input.scenario.video;
	if (!declaration) return { failures: [], graphs: [] };
	const failures: string[] = [],
		observations: VideoObservation[] = [];
	for (const clip of declaration.clips) {
		for (const viewport of clip.viewports) {
			const checked = clipObservation(input, admitted, clip, viewport);
			if (checked.failure) failures.push(checked.failure);
			if (checked.observation) observations.push(checked.observation);
		}
	}

	const graphs = new VideoEvidenceService().coverage(declaration, observations);
	for (const graph of graphs)
		if (!graph.complete)
			failures.push(`video graph ${graph.graph} is incomplete: ${graph.missing.join(', ')}`);
	return { failures, graphs };
}

function clipObservation(
	input: CoverageInput,
	admitted: Gathered[],
	clip: VideoClip,
	viewport: string
): {
	failure?: string;
	observation?: VideoObservation;
} {
	const matches = admitted.filter(
		(item) =>
			item.line.kind === 'video' &&
			item.line.video?.clipId === clip.id &&
			item.line.viewport === viewport
	);
	const prefix = `video clip ${clip.id}/${viewport}`;
	if (matches.length !== 1 || input.checkFailed)
		return { failure: `${prefix} has no unique passing capture` };
	const item = matches[0],
		video = item.line.video!;
	const slot = input.videoSlots?.find(
		(slot) => slot.unit === clip.unit && slot.clipId === clip.id && slot.viewport === viewport
	);
	if (slot?.inputHash !== video.inputHash)
		return { failure: `${prefix} has a stale or unproved current input hash` };
	if (!clipBinding(clip, item))
		return { failure: `${prefix} has an incompatible owner, checkpoint or graph proof` };
	const flagFailure = videoFlagCoverageFailure(input.pendingVideoFlags, item);
	if (flagFailure) return { failure: `${prefix} ${flagFailure}` };
	return {
		observation: {
			clipId: clip.id,
			viewport,
			fresh: true,
			durationSeconds: item.line.durationSeconds ?? 0,
			states: video.states,
			edges: video.edges
		}
	};
}

function clipBinding(clip: VideoClip, item: Gathered): boolean {
	const video = item.line.video!;
	const duration = item.line.durationSeconds ?? 0;
	if (
		video.unit !== clip.unit ||
		item.line.state !== clip.state ||
		video.entry !== clip.entry ||
		video.exit !== clip.exit ||
		duration > clip.durationSeconds
	)
		return false;
	return (
		visitsProved(clip.states, video.states, duration) &&
		visitsProved(clip.edges, video.edges, duration)
	);
}

function visitsProved(
	ids: string[],
	visits: VideoObservation['states'],
	duration: number
): boolean {
	return (
		visits.every(
			(visit) => ids.includes(visit.id) && visit.atSeconds >= 0 && visit.atSeconds < duration
		) && ids.every((id) => visits.some((visit) => visit.id === id && visit.atSeconds < duration))
	);
}
