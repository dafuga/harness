// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { batchLimit, mediaLimit } from './schema';
import type {
	VideoArchiveBatch,
	VideoArchiveClip,
	VideoArchiveManifest,
	VideoArchiveSlot,
	VideoArchiveSealedValue
} from '../VideoArchiveService.types';

export const digest = (bytes: Buffer | string): string =>
	createHash('sha256').update(bytes).digest('hex');
export const sealedBytes = (value: VideoArchiveSealedValue): Buffer =>
	Buffer.from(canonicalJson(value) + '\n');
export const slotKey = (slot: VideoArchiveSlot): string => canonicalJson(slot);

/** Partition descriptors without allocating or decoding media. Unique objects consume the budget once. */
export function splitVideoBatches(clips: VideoArchiveClip[]): VideoArchiveClip[][] {
	const groups: VideoArchiveClip[][] = [];
	let group: VideoArchiveClip[] = [];
	for (const clip of clips) {
		if (group.length && (group.length === 64 || mediaBytes([...group, clip]) > batchLimit)) {
			groups.push(group);
			group = [];
		}
		if (mediaBytes([clip]) > batchLimit)
			throw new ExpectedCliError('Video batch exceeds its byte limit.');
		group.push(clip);
	}
	if (group.length) groups.push(group);
	return groups;
}

export function mediaObjects(clips: VideoArchiveClip[]): Map<string, VideoArchiveClip['media']> {
	const objects = new Map<string, VideoArchiveClip['media']>();
	for (const clip of clips)
		for (const object of [clip.media, clip.poster]) {
			if (object.bytes > mediaLimit)
				throw new ExpectedCliError('Video media exceeds the clip limit.');
			const existing = objects.get(object.path);
			if (existing && canonicalJson(existing) !== canonicalJson(object))
				throw new ExpectedCliError('Conflicting media identity.');
			objects.set(object.path, object);
		}
	return objects;
}

function mediaBytes(clips: VideoArchiveClip[]): number {
	const unique = new Map<string, number>();
	for (const object of mediaObjects(clips).values()) {
		if (unique.has(object.sha256) && unique.get(object.sha256) !== object.bytes)
			throw new ExpectedCliError('Conflicting media byte length.');
		unique.set(object.sha256, object.bytes);
	}
	return [...unique.values()].reduce((sum, bytes) => sum + bytes, 0);
}

export function validateBatch(batch: VideoArchiveBatch): void {
	if (splitVideoBatches(batch.clips).length !== 1)
		throw new ExpectedCliError('Video batch limit exceeded.');
	const slots = new Set<string>();
	for (const clip of batch.clips) {
		const key = slotKey(clip.slot);
		if (slots.has(key)) throw new ExpectedCliError('Duplicate video slot in batch.');
		slots.add(key);
		validateClip(clip);
	}
}

export function validateClip(clip: VideoArchiveClip): void {
	const { video, slot } = clip,
		visits = [...video.states, ...video.edges];
	if (
		slot.unit !== video.unit ||
		slot.clipId !== video.clipId ||
		slot.profile !== video.profile ||
		!video.states.some((state) => state.id === slot.state) ||
		visits.some((visit) => visit.atSeconds >= clip.durationSeconds) ||
		video.poster.timeSeconds >= clip.durationSeconds
	)
		throw new ExpectedCliError('Video metadata does not match its slot or timeline.');
	validateMediaPaths(clip);
}

function validateMediaPaths(clip: VideoArchiveClip): void {
	const { video } = clip;
	if (
		clip.media.path !== `media/${clip.media.sha256}.mp4` ||
		clip.poster.path !== `media/${clip.poster.sha256}.png` ||
		clip.poster.sha256 !== video.poster.sha256 ||
		clip.poster.bytes !== video.poster.bytes
	)
		throw new ExpectedCliError('Video media paths or poster identity do not match.');
}

export function batchManifest(batch: VideoArchiveBatch, bytes: Buffer): VideoArchiveManifest {
	return {
		schemaVersion: 1,
		kind: 'harness-video-batch-manifest',
		batch: digest(bytes),
		files: [
			{ path: 'batch.json', sha256: digest(bytes), bytes: bytes.length, lfs: false },
			...[...mediaObjects(batch.clips).values()]
				.sort((a, b) => a.path.localeCompare(b.path))
				.map((object) => ({ ...object, lfs: true }))
		]
	};
}
