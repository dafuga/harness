// @harness-uid u_lnqhwcablp
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';
import type { MediaFacts } from '../../../../utils/verification-evidence/mediaFacts';

/** Compare decoded facts and retained visits without changing a capture or its provenance. */
export function videoMetadataProblem(
	video: NonNullable<Gathered['line']['video']>,
	facts: Extract<MediaFacts, { kind: 'video' }>,
	line: Gathered['line']
): string | undefined {
	const pairs = [
		[video.width, facts.width],
		[video.height, facts.height],
		[video.frameCount, facts.frameCount],
		[video.frameRate, facts.frameRate],
		[line.durationSeconds ?? 0, facts.durationSeconds]
	];
	if (!pairs.every(([declared, actual]) => Math.abs(declared - actual) <= 0.05))
		return 'video facts do not match decoded media';
	const times = [...video.states, ...video.edges]
		.map((visit) => visit.atSeconds)
		.concat(video.poster.timeSeconds);
	if (!times.every((time) => time >= 0 && time <= facts.durationSeconds))
		return 'has a timestamp outside the retained video interval';
	if (!video.states.some((visit) => visit.id === line.state))
		return `does not visibly assert state ${line.state}`;
	return undefined;
}
