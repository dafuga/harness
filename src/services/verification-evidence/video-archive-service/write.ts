// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { lstat } from 'node:fs/promises';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { lfsPointer } from '../../../utils/verification-evidence/lfsPointer';
import {
	batchManifest,
	digest,
	sealedBytes,
	slotKey,
	splitVideoBatches,
	validateBatch
} from './batch';
import { batchSchema, clipSchema, mediaLimit } from './schema';
import { inspectMedia, retainedMedia } from './media';
import { retainSource, sourceBinding } from './source';
import type {
	AdmittedVideo,
	VideoArchiveClip,
	VideoArchiveInput,
	VideoBatchPointer
} from '../VideoArchiveService.types';

export async function writeVideoBatches(
	root: string,
	inputs: VideoArchiveInput[]
): Promise<VideoBatchPointer[]> {
	const admitted = inputs.map(admit),
		sources = new Set<string>(),
		decoded = new Set<string>();
	if (new Set(admitted.map(({ clip }) => slotKey(clip.slot))).size !== admitted.length)
		throw new ExpectedCliError('Duplicate video slot in archive write.');
	for (const { clip, files } of admitted) {
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
	const bySlot = new Map(admitted.map((item) => [slotKey(item.clip.slot), item]));
	const pointers: VideoBatchPointer[] = [];
	for (const clips of splitVideoBatches(admitted.map((item) => item.clip)))
		pointers.push(
			await storeBatch(
				root,
				clips.map((clip) => bySlot.get(slotKey(clip.slot))!)
			)
		);
	return pointers;
}

function admit(input: VideoArchiveInput): AdmittedVideo {
	if (
		!Buffer.isBuffer(input.videoBytes) ||
		!Buffer.isBuffer(input.posterBytes) ||
		input.videoBytes.length > mediaLimit ||
		input.posterBytes.length > mediaLimit
	)
		throw new ExpectedCliError('Video or poster exceeds the clip byte limit.');
	const clip = clipSchema.parse({
		slot: input.slot,
		original: input.original,
		video: input.video,
		durationSeconds: input.durationSeconds,
		media: {
			path: `media/${input.sha256}.mp4`,
			sha256: input.sha256,
			bytes: input.videoBytes.length
		},
		poster: {
			path: `media/${input.video.poster.sha256}.png`,
			sha256: input.video.poster.sha256,
			bytes: input.posterBytes.length
		}
	});
	validateBatch({ schemaVersion: 1, kind: 'harness-video-batch', clips: [clip] });
	const files = new Map([
		[clip.media.path, Buffer.from(input.videoBytes)],
		[clip.poster.path, Buffer.from(input.posterBytes)]
	]);
	for (const object of [clip.media, clip.poster])
		if (digest(files.get(object.path)!) !== object.sha256)
			throw new ExpectedCliError('Admitted video hash mismatch.');
	return { clip, files };
}

async function storeBatch(root: string, admitted: AdmittedVideo[]): Promise<VideoBatchPointer> {
	const batch = batchSchema.parse({
		schemaVersion: 1,
		kind: 'harness-video-batch',
		clips: admitted.map((item) => item.clip)
	});
	validateBatch(batch);
	const bytes = sealedBytes(batch),
		hash = digest(bytes),
		manifest = batchManifest(batch, bytes);
	const manifestBytes = sealedBytes(manifest),
		lfs = new LfsAdapter(root),
		files = [];
	if (bytes.length > 1024 * 1024 || manifestBytes.length > 1024 * 1024)
		throw new ExpectedCliError('Video batch metadata exceeds its byte limit.');
	for (const object of manifest.files.filter((file) => file.lfs)) {
		const data = admitted.find((item) => item.files.has(object.path))!.files.get(object.path)!;
		await storeMedia(lfs, object, data);
		files.push({ path: object.path, content: { bytes: lfsPointer(object) } });
	}
	for (const revision of new Set(batch.clips.map((clip) => clip.original.revision)))
		await retainSource(root, revision);
	const path = `video-batches/${hash}`,
		stored = await new EvidenceBranchRepository(root).add(
			path,
			[
				{ path: 'batch.json', content: { bytes } },
				{ path: 'manifest.json', content: { bytes: manifestBytes } },
				...files
			],
			'feat: retain sealed video batch',
			'batch.json'
		);
	return {
		schemaVersion: 1,
		kind: 'harness-video-batch',
		batch: hash,
		evidence: { commit: stored.commit, path, manifest: digest(manifestBytes) }
	};
}

async function storeMedia(
	lfs: LfsAdapter,
	object: VideoArchiveClip['media'],
	data: Buffer
): Promise<void> {
	const existing = await lstat(await lfs.path(object.sha256)).catch((error: { code?: string }) => {
		if (error.code !== 'ENOENT') throw error;
		return undefined;
	});
	if (!existing) await lfs.store(data);
	await retainedMedia(lfs, object);
}
