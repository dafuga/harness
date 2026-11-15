// @harness-uid u_3flwsx2557
import type { RunContext } from './CheckRunService.types';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';
import type { VideoGatherContext } from './gatherVideoReferences.types';
import { ExpectedCliError } from '../../../../../core/development-tooling/errors';

export function checkVideoContext(
	context: RunContext,
	check: PlannedCheck
): VideoGatherContext | undefined {
	const video = context.videoCapture,
		slots = video?.slots[check.scenario ?? ''];
	return video && slots?.length ? { ...video, slots } : undefined;
}

export function checkVideoEnvironment(
	context: RunContext,
	check: PlannedCheck
): Record<string, string | undefined> {
	const video = checkVideoContext(context, check);
	if (!video) return { HARNESS_VIDEO_CAPTURE_CONTEXT: undefined };
	const encoded = JSON.stringify({
		schemaVersion: 1,
		repository: video.repository,
		source: video.source,
		pinned: video.pinned,
		snapshot: context.snapshot,
		slots: video.slots.map(({ unit, clipId, viewport, inputHash, reasons }) => ({
			unit,
			clipId,
			viewport,
			inputHash,
			...(reasons?.some((reason) => reason.includes('recording required'))
				? { reasons: ['recording required: source closure is uncertain'] }
				: {})
		}))
	});
	if (Buffer.byteLength(encoded) > 60 * 1024)
		throw new ExpectedCliError(
			'Video capture context exceeds the bounded 60 KiB process environment.'
		);
	return { HARNESS_VIDEO_CAPTURE_CONTEXT: encoded };
}
