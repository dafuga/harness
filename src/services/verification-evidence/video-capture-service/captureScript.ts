// @harness-uid u_2eznkaf4qv
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type {
	VideoCaptureInput,
	VideoCapturePlan,
	VideoCaptureScript,
	VideoCaptureScriptInput
} from '../VideoCaptureService.types';
import type { NativeRecordingSession } from '../NativeVideoRecorderService.types';

export function recordingAllowed(input: VideoCaptureInput): void {
	const task = 'video-build-20261115';
	if (
		process.platform !== 'darwin' ||
		process.env.CI ||
		input.env?.CI ||
		input.recordingAuthorization?.task !== task ||
		input.env?.HARNESS_VIDEO_RECORD_TASK !== task
	)
		throw new ExpectedCliError(
			'Video recording is not authorized on this host/task; supply intact attached references or run the explicitly approved recording task.'
		);
}
export function captureScriptInput(
	plan: VideoCapturePlan,
	slot: VideoCaptureScriptInput['slot']
): VideoCaptureScriptInput {
	const clip = plan.manifest.clips.find(
		(clip) => clip.id === slot.clipId && clip.unit === slot.unit
	)!;
	const viewport = plan.manifest.viewports.find((viewport) => viewport.id === slot.viewport)!;
	return {
		clip,
		slot,
		viewport,
		pendingFlags: plan.pending
			.filter(
				(flag) =>
					flag.unit === slot.unit && flag.clipId === slot.clipId && flag.viewport === slot.viewport
			)
			.map((flag) => ({ id: flag.id, note: flag.note }))
	};
}
export function admittedScript(
	script: VideoCaptureScript,
	input: VideoCaptureScriptInput,
	plan: VideoCapturePlan
): void {
	const addressed = script.addressedFlags ?? [],
		pending = input.pendingFlags;
	const known = new Set(
		plan.known
			.filter(
				(flag) =>
					flag.unit === input.slot.unit &&
					flag.clipId === input.slot.clipId &&
					flag.viewport === input.slot.viewport
			)
			.map((flag) => flag.id)
	);
	if (pending.some((flag) => !addressed.includes(flag.id)))
		throw new ExpectedCliError(
			'Recording script must explicitly address every pending reviewer flag.'
		);
	if (addressed.some((id) => !known.has(id)))
		throw new ExpectedCliError(
			'Recording script addresses an unknown or wrong-owner reviewer flag.'
		);
	if (
		input.clip.checkpoints?.some((row) => row.viewport === input.viewport.id) &&
		!script.checkpoint
	)
		throw new ExpectedCliError(
			'Configured video checkpoints require an observed checkpoint callback.'
		);
}
export async function captureCheckpoint(
	script: VideoCaptureScript,
	target: Pick<VideoCaptureScriptInput, 'clip' | 'viewport'>,
	session: NativeRecordingSession,
	boundary: 'entry' | 'exit'
): Promise<string | undefined> {
	const expected = target.clip.checkpoints?.find((row) => row.viewport === target.viewport.id);
	if (!script.checkpoint) {
		if (expected) throw new ExpectedCliError('Configured video checkpoint callback is missing.');
		return undefined;
	}
	const observed = await script.checkpoint(session);
	if (!/^[a-f0-9]{64}$/.test(observed))
		throw new ExpectedCliError('Observed video checkpoint must be a SHA-256 signature.');
	if (
		expected &&
		observed !== (boundary === 'entry' ? expected.entrySignature : expected.exitSignature)
	)
		throw new ExpectedCliError(
			`Observed ${boundary} video checkpoint does not match the declared viewport boundary.`
		);
	return observed;
}
