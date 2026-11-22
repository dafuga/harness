// @harness-uid u_2eznkaf4qv
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { VideoCaptureScriptInput } from '../VideoCaptureService.types';
import type { NativeRecording } from '../NativeVideoRecorderService.types';
import type { VideoCapture } from '../../../utils/verification-evidence/videoClipSchema.types';

export function observedVideo(
	target: VideoCaptureScriptInput,
	native: NativeRecording,
	signatures: { entry?: string; exit?: string },
	stem: string
): VideoCapture {
	const { clip, slot, viewport } = target,
		{ metadata } = native;
	const visits = (kind: 'state' | 'edge') =>
		metadata.events
			.filter((event) => event.kind === kind)
			.map(({ id, atSeconds }) => ({ id, atSeconds }));
	return {
		schemaVersion: 1,
		unit: slot.unit,
		clipId: slot.clipId,
		inputHash: slot.inputHash,
		entry: clip.entry,
		exit: clip.exit,
		...(signatures.entry ? { entrySignature: signatures.entry } : {}),
		...(signatures.exit ? { exitSignature: signatures.exit } : {}),
		profile: 'normal',
		states: visits('state'),
		edges: visits('edge'),
		width: viewport.width,
		height: viewport.height,
		frameRate: metadata.facts.frameRate,
		sourceFrameRate: metadata.native.meanFrameRate,
		frameCount: metadata.facts.frameCount,
		poster: {
			file: `${stem}.png`,
			sha256: native.poster.sha256,
			bytes: native.poster.bytes,
			timeSeconds: metadata.posterFrame / metadata.facts.frameRate
		},
		addressedFlags: metadata.addressedFlags
	};
}

export function validateVisits(
	target: VideoCaptureScriptInput,
	video: VideoCapture,
	duration: number
): void {
	const { clip } = target,
		{ states, edges } = video;
	if (
		states[0]?.id !== clip.entry ||
		states.at(-1)?.id !== clip.exit ||
		!states.some((state) => state.id === clip.state)
	)
		throw new ExpectedCliError('Observed video states do not prove entry, owning state and exit.');
	for (const [expected, visits] of [
		[clip.states, states],
		[clip.edges, edges]
	] as const)
		if (
			expected.some((id) => !visits.some((visit) => visit.id === id)) ||
			visits.some(
				(visit) =>
					!expected.includes(visit.id) || visit.atSeconds < 0 || visit.atSeconds >= duration
			)
		)
			throw new ExpectedCliError(
				'Observed video state/edge visits do not match the declared clip interval.'
			);
	if (duration > clip.durationSeconds)
		throw new ExpectedCliError('Recorded video exceeds its declared clip duration.');
}
