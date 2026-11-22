// @harness-uid u_rfumv65ikl
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { FrameFlag } from '../FrameFlagService.types';

/** Current proof checks share attachment admission without changing historical media integrity. */
export function attachedVideoFlagFailure(
	record: string,
	capture: Capture,
	flags: FrameFlag[]
): string | undefined {
	const video = capture.video!,
		addressed = video.addressedFlags ?? [];
	const known = flags.filter(
		(flag) =>
			flag.clip.unit === video.unit &&
			flag.clip.clipId === video.clipId &&
			flag.clip.viewport === capture.viewport
	);
	if (addressed.some((id) => !known.some((flag) => flag.id === id && flag.clip.record !== record)))
		return 'Replacement addresses an unknown or wrong-owner frame flag.';
	if (known.some((flag) => flag.status !== 'resolved' && !addressed.includes(flag.id)))
		return 'Replacement must explicitly address every pending frame flag; a late flag remains pending.';
	if (
		known.some(
			(flag) =>
				addressed.includes(flag.id) &&
				!(Date.parse(capture.capturedAt) > Date.parse(flag.createdAt))
		)
	)
		return 'Replacement capture predates its addressed reviewer frame flag.';
	return undefined;
}
