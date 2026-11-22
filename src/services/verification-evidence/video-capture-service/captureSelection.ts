// @harness-uid u_2eznkaf4qv
import { selectVideoSlots } from '../video-evidence-service/selectVideoSlots';
import { VideoEvidenceService } from '../VideoEvidenceService';
import { videoClipSchema } from '../../../utils/verification-evidence/videoClipSchema';
import { readFrameFlags } from '../frame-flag-service/flagStore';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { captureContext } from './captureContext';
import type {
	VideoCaptureInput,
	VideoCapturePlan,
	VideoCaptureServices
} from '../VideoCaptureService.types';
import type { VideoSlot } from '../VideoEvidenceService.types';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { FrameFlag } from '../FrameFlagService.types';

/** Metadata-first proposals are never reused until the parent-linked media resolver admits them. */
export async function captureSelection(
	input: VideoCaptureInput,
	references: NonNullable<VideoCaptureServices['references']>,
	root: string
): Promise<VideoCapturePlan> {
	const manifest = videoClipSchema(input.declaration);
	if (manifest.clips.reduce((total, clip) => total + clip.viewports.length, 0) > 4096)
		throw new ExpectedCliError('Video capture run exceeds the fixed 4096-slot metadata cap.');
	const slots = currentCaptureSlots(input, root);
	const flags = await readFrameFlags(root),
		pending = flags
			.filter(
				(flag) => flag.status !== 'resolved' && slots.some((slot) => sameSlot(slot, flag.clip))
			)
			.map((flag) => ({
				id: flag.id,
				unit: flag.clip.unit,
				clipId: flag.clip.clipId,
				viewport: flag.clip.viewport,
				note: flag.note,
				createdAt: flag.createdAt
			}));
	const known = flags
		.filter((flag) => slots.some((slot) => sameSlot(slot, flag.clip)))
		.map((flag) => ({
			id: flag.id,
			unit: flag.clip.unit,
			clipId: flag.clip.clipId,
			viewport: flag.clip.viewport,
			createdAt: flag.createdAt
		}));
	const plan: VideoCapturePlan = { manifest, slots, record: [], reuse: [], pending, known };
	for (const slot of slots) {
		const retained = await reusableCapture(input, slot, flags, references);
		if (retained) plan.reuse.push({ slot, ...retained });
		else plan.record.push(slot);
	}
	return plan;
}
async function reusableCapture(
	input: VideoCaptureInput,
	slot: VideoSlot,
	flags: FrameFlag[],
	references: NonNullable<VideoCaptureServices['references']>
) {
	if (
		slot.reasons?.some((reason) => reason.includes('recording required')) ||
		flags.some((flag) => sameSlot(slot, flag.clip) && flag.status !== 'resolved')
	)
		return undefined;
	let candidates: Awaited<ReturnType<typeof references.candidates>>;
	try {
		candidates = await references.candidates(slot);
	} catch {
		return undefined;
	}
	for (const proposal of candidates) {
		try {
			const verified = await references.resolve({
				source: input.source,
				capture: proposal.capture,
				batches: proposal.batches
			});
			if (!currentProposal(slot, verified) || flaggedOriginal(proposal.capture, flags)) continue;
			const allowed = selectVideoSlots([slot], [{ ...slot, inputHash: verified.inputHash }]);
			if (!allowed.reuse.some((item) => sameSlot(item, slot) && item.inputHash === slot.inputHash))
				continue;
			return { capture: proposal.capture, batches: proposal.batches };
		} catch {
			/* A broken proposal never hides a valid sibling or starts a recorder. */
		}
	}
	return undefined;
}
function currentProposal(
	slot: VideoSlot,
	verified: Awaited<ReturnType<NonNullable<VideoCaptureServices['references']>['resolve']>>
): boolean {
	return verified.inputHash === slot.inputHash && sameSlot(slot, verified.clip.slot);
}
function flaggedOriginal(capture: Capture, flags: FrameFlag[]): boolean {
	return flags.some(
		(flag) =>
			sameSlot(
				{ unit: capture.video!.unit, clipId: capture.video!.clipId, viewport: capture.viewport! },
				flag.clip
			) &&
			flag.clip.sha256 === capture.sha256 &&
			(!(capture.video!.addressedFlags ?? []).includes(flag.id) ||
				Date.parse(capture.capturedAt) <= Date.parse(flag.createdAt))
	);
}
export function sameSlot(
	left: Pick<VideoSlot, 'unit' | 'clipId' | 'viewport'>,
	right: Pick<VideoSlot, 'unit' | 'clipId' | 'viewport'>
): boolean {
	return (
		left.unit === right.unit && left.clipId === right.clipId && left.viewport === right.viewport
	);
}
function currentCaptureSlots(input: VideoCaptureInput, root: string): VideoSlot[] {
	const context = captureContext(input, root);
	if (!context) return new VideoEvidenceService(input.snapshot).plan(input.declaration).record;
	const declaration = videoClipSchema(input.declaration);
	return declaration.clips.flatMap((clip) =>
		clip.viewports.map((viewport) => {
			const slot = context.slots.find(
				(slot) => slot.unit === clip.unit && slot.clipId === clip.id && slot.viewport === viewport
			);
			if (!slot || !/^[a-f0-9]{64}$/.test(slot.inputHash))
				throw new ExpectedCliError(
					'Video capture context has no independently computed current slot.'
				);
			return slot;
		})
	);
}
