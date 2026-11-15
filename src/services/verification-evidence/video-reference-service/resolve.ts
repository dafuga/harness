// @harness-uid u_alfe4qnget
import { captureSchema } from '../../../core/verification-evidence/verificationTypes';
import { videoBatchPointerSchema } from '../../../utils/verification-evidence/videoClipSchema';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
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
	const selected = await new VideoArchiveService(root).readClip(
		pointers[0],
		{
			unit: video.unit,
			unitUid: uid,
			clipId: video.clipId,
			state: capture.state,
			viewport: capture.viewport!,
			profile: video.profile,
			inputHash: video.inputHash
		},
		pinned.evidence
	);
	bindReference(input, selected.clip);
	await proveOriginal(root, capture, { ...context, pinned });
	const [path, poster] = referencePaths(capture),
		clip = selected.clip;
	return {
		clip,
		pointer: selected.pointer,
		inputHash: clip.video.inputHash,
		origin: {
			...clip.original,
			...(capture.videoReference.record ? { record: capture.videoReference.record } : {})
		},
		files: new Map([
			[path, selected.files.get(clip.media.path)!],
			[poster, selected.files.get(clip.poster.path)!]
		])
	};
}
