// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { evidenceMarker } from '../../../core/git-source-history/historyTypes';
import { lfsPointer } from '../../../utils/verification-evidence/lfsPointer';
import { batchManifest, digest, mediaObjects, sealedBytes, validateBatch } from './batch';
import { batchSchema, manifestSchema, pointerSchema } from './schema';
import { inspectMedia, retainedMedia } from './media';
import { sourceBinding } from './source';
import type {
	VideoArchiveCurrent,
	VideoArchiveSelection,
	VideoArchiveDescriptor,
	VideoArchiveRead,
	VideoBatchPointer
} from '../VideoArchiveService.types';

export async function readVideoBatch(
	root: string,
	input: VideoBatchPointer,
	within?: string
): Promise<VideoArchiveRead> {
	const descriptor = await readVideoBatchDescriptor(root, input, within);
	const files = await loadMedia(root, new EvidenceBranchRepository(root), descriptor);
	return { ...descriptor, files };
}

/** Validate only selected clip objects; corrupt unrelated media never forces a healthy clip to re-record. */
export async function readVideoBatchClip(
	root: string,
	pointer: VideoBatchPointer,
	selection: VideoArchiveSelection,
	within?: string
): Promise<VideoArchiveCurrent> {
	const descriptor = await readVideoBatchDescriptor(root, pointer, within);
	const { inputHash, ...slot } = selection;
	const clip = descriptor.batch.clips.find(
		(item) => canonicalJson(item.slot) === canonicalJson(slot) && item.video.inputHash === inputHash
	);
	if (!clip)
		throw new ExpectedCliError('Selected video clip does not match the archived slot/input hash.');
	const files = await loadMedia(root, new EvidenceBranchRepository(root), {
		pointer: descriptor.pointer,
		batch: { ...descriptor.batch, clips: [clip] }
	});
	return { pointer: descriptor.pointer, clip, files };
}

/** Sealed descriptors can be checked before explicitly fetching their missing source and media. */
export async function readVideoBatchDescriptor(
	root: string,
	input: VideoBatchPointer,
	within?: string
): Promise<VideoArchiveDescriptor> {
	const pointer = pointerSchema.parse(input),
		repository = new EvidenceBranchRepository(root);
	await archiveSnapshot(repository, pointer, within);
	const { commit, path } = pointer.evidence;
	const bytes = await boundedBlob(repository, commit, `${path}/batch.json`);
	const manifestBytes = await boundedBlob(repository, commit, `${path}/manifest.json`);
	if (digest(bytes) !== pointer.batch || digest(manifestBytes) !== pointer.evidence.manifest)
		throw new ExpectedCliError('Video batch or manifest hash seal failed.');
	const batch = batchSchema.parse(JSON.parse(bytes.toString())),
		manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString()));
	validateBatch(batch);
	if (
		!bytes.equals(sealedBytes(batch)) ||
		!manifestBytes.equals(sealedBytes(batchManifest(batch, bytes)))
	)
		throw new ExpectedCliError('Video batch manifest content seal failed.');
	const expected = new Set([
		'batch.json',
		'manifest.json',
		...manifest.files.filter((file) => file.lfs).map((file) => file.path)
	]);
	const actual = [...(await repository.tree.list(commit, [`${path}/`])).keys()].filter((file) =>
		file.startsWith(`${path}/`)
	);
	if (
		actual.length !== expected.size ||
		actual.some((file) => !expected.has(file.slice(path.length + 1)))
	)
		throw new ExpectedCliError('Video batch has missing or unexpected files.');
	return { pointer, batch };
}

async function archiveSnapshot(
	repository: EvidenceBranchRepository,
	pointer: VideoBatchPointer,
	within?: string
): Promise<void> {
	const tip = within ?? (await repository.tip()),
		{ commit, path } = pointer.evidence;
	if (
		(await repository.tree.git.attempt(['rev-parse', '--verify', `${commit}^{commit}`])) !== commit
	)
		throw new ExpectedCliError('Video evidence ancestry does not name the exact immutable commit.');
	if (!tip || !/^[a-f0-9]{40}$/.test(tip) || !(await repository.tree.contains(tip, commit)))
		throw new ExpectedCliError('Video batch is outside the requested evidence ancestry.');
	if (path !== `video-batches/${pointer.batch}`)
		throw new ExpectedCliError('Video batch path seal mismatch.');
	const marker = JSON.parse((await boundedBlob(repository, commit, evidenceMarker)).toString());
	if (marker.schemaVersion !== 1 || marker.kind !== 'harness-evidence')
		throw new ExpectedCliError('Invalid evidence ancestry marker.');
}

async function loadMedia(
	root: string,
	repository: EvidenceBranchRepository,
	read: VideoArchiveDescriptor
): Promise<Map<string, Buffer>> {
	const { pointer, batch } = read,
		files = new Map<string, Buffer>(),
		lfs = new LfsAdapter(root);
	for (const object of mediaObjects(batch.clips).values()) {
		const bytes = await boundedBlob(
			repository,
			pointer.evidence.commit,
			`${pointer.evidence.path}/${object.path}`
		);
		if (bytes.toString() !== lfsPointer(object))
			throw new ExpectedCliError('Video media LFS pointer integrity failed.');
		files.set(object.path, await retainedMedia(lfs, object));
	}
	const decoded = new Set<string>(),
		sources = new Set<string>();
	for (const clip of batch.clips) {
		const source = `${clip.original.revision}:${clip.original.tree}:${clip.slot.unit}:${clip.slot.unitUid}`;
		if (!sources.has(source)) {
			await sourceBinding(root, clip);
			sources.add(source);
		}
		const key = digest(
			sealedBytes({ video: clip.video, media: clip.media, duration: clip.durationSeconds })
		);
		if (!decoded.has(key)) {
			inspectMedia(clip, files);
			decoded.add(key);
		}
	}
	return files;
}

async function boundedBlob(
	repository: EvidenceBranchRepository,
	commit: string,
	path: string
): Promise<Buffer> {
	const size = Number(await repository.tree.git.attempt(['cat-file', '-s', `${commit}:${path}`]));
	if (!Number.isSafeInteger(size) || size < 1 || size > 1024 * 1024)
		throw new ExpectedCliError('Video batch metadata is missing or oversized.');
	const bytes = await repository.tree.read(commit, path);
	if (bytes?.length !== size) throw new ExpectedCliError('Video batch metadata integrity failed.');
	return bytes;
}
