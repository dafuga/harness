// @harness-uid u_alfe4qnget
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { VideoArchiveCurrent } from '../VideoArchiveService.types';
import { captureSchema } from '../../../core/verification-evidence/verificationTypes';
import { videoBatchPointerSchema } from '../../../utils/verification-evidence/videoClipSchema';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { VideoArchiveService } from '../VideoArchiveService';
import { bindReference, currentOwner, referencePaths } from './binding';
import { proveOriginal, referenceScope } from './origins';
import type {
	TrustedVideoReference,
	VideoReferenceContext,
	VideoReferenceInput
} from '../VideoReferenceService.types';

export async function resolveVideoReference(
	root: string,
	proposed: VideoReferenceInput,
	context: VideoReferenceContext
): Promise<TrustedVideoReference> {
	const capture = captureSchema.parse(proposed.capture),
		video = capture.video;
	if (!video || !capture.videoReference)
		throw new ExpectedCliError('Capture needs video metadata and a batch reference.');
	const batches = proposed.batches.map((pointer) => videoBatchPointerSchema.parse(pointer));
	const pointers = batches.filter((pointer) => pointer.batch === capture.videoReference!.batch);
	if (pointers.length !== 1)
		throw new ExpectedCliError(
			'Video reference requires exactly one matching parent batch pointer.'
		);
	const input = { ...proposed, capture, batches },
		uid = await currentOwner(root, input);
	const pinned = await referenceScope(root, context);
	if (!pinned.evidence)
		throw new ExpectedCliError('Referenced video evidence is not available in this snapshot.');
	const archive = new VideoArchiveService(root),
		selection = {
			unit: video.unit,
			unitUid: uid,
			clipId: video.clipId,
			state: capture.state,
			viewport: capture.viewport!,
			profile: video.profile,
			inputHash: video.inputHash
		};
	const { inputHash, ...slot } = selection;
	const descriptor = await archive.describe(pointers[0], pinned.evidence);
	const metadata = descriptor.batch.clips.find(
		(clip) => canonicalJson(clip.slot) === canonicalJson(slot) && clip.video.inputHash === inputHash
	);
	if (!metadata)
		throw new ExpectedCliError('Selected video slot/input does not match its archived metadata.');
	bindReference(input, metadata);
	await proveOriginal(root, capture, { ...context, pinned });
	const selected = await archive.readClip(pointers[0], selection, pinned.evidence);
	return trustedResult(capture, selected);
}

function trustedResult(capture: Capture, selected: VideoArchiveCurrent): TrustedVideoReference {
	const [path, poster] = referencePaths(capture),
		clip = selected.clip,
		record = capture.videoReference?.record;
	return {
		clip,
		pointer: selected.pointer,
		inputHash: clip.video.inputHash,
		origin: {
			...clip.original,
			...(record ? { record } : {})
		},
		files: new Map([
			[path, selected.files.get(clip.media.path)!],
			[poster, selected.files.get(clip.poster.path)!]
		])
	};
}
