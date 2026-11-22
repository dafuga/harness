// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import type { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { digest } from './batch';
import { mediaLimit } from './schema';
import type { ArchiveVideoFacts, VideoArchiveClip } from '../VideoArchiveService.types';

/** Bound every disk read before allocating; symlinks and changed lengths fail closed. */
export async function retainedMedia(
	lfs: LfsAdapter,
	object: VideoArchiveClip['media']
): Promise<Buffer> {
	if (object.bytes > mediaLimit) throw new ExpectedCliError('Video media exceeds its byte limit.');
	const file = await open(
		await lfs.path(object.sha256),
		constants.O_RDONLY | constants.O_NOFOLLOW
	).catch(() => {
		throw new ExpectedCliError('Video media is missing or not a regular file.');
	});
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.size !== object.bytes)
			throw new ExpectedCliError('Video media integrity size mismatch.');
		const bytes = Buffer.alloc(object.bytes),
			read = await file.read(bytes, 0, bytes.length, 0);
		if (read.bytesRead !== bytes.length || digest(bytes) !== object.sha256)
			throw new ExpectedCliError('Video media hash integrity failed.');
		return bytes;
	} finally {
		await file.close();
	}
}

export function inspectMedia(clip: VideoArchiveClip, files: Map<string, Buffer>): void {
	const video = files.get(clip.media.path)!,
		poster = files.get(clip.poster.path)!;
	checkMediaBytes(clip, files);
	const facts = mediaFacts(video, 'video/mp4'),
		image = mediaFacts(poster, 'image/png');
	if (!('kind' in facts) || facts.kind !== 'video' || !('kind' in image) || image.kind !== 'image')
		throw new ExpectedCliError('Video or poster could not be decoded.');
	validateVideoFacts(clip, facts);
	if (image.width !== facts.width || image.height !== facts.height)
		throw new ExpectedCliError('Poster dimensions do not match the video.');
	const pixels = facts.width * facts.height * 3;
	if (
		!decodedPixels(poster, [], pixels).equals(
			decodedPixels(video, ['-ss', String(clip.video.poster.timeSeconds)], pixels)
		)
	)
		throw new ExpectedCliError('Poster pixels do not match the declared video frame.');
}

function checkMediaBytes(clip: VideoArchiveClip, files: Map<string, Buffer>): void {
	for (const object of [clip.media, clip.poster]) {
		const bytes = files.get(object.path);
		if (bytes?.length !== object.bytes || digest(bytes) !== object.sha256)
			throw new ExpectedCliError('Video media hash integrity failed.');
	}
}

function validateVideoFacts(clip: VideoArchiveClip, facts: ArchiveVideoFacts): void {
	if (
		facts.width !== clip.video.width ||
		facts.height !== clip.video.height ||
		facts.frameCount !== clip.video.frameCount ||
		Math.abs(facts.frameRate - clip.video.frameRate) > 0.001 ||
		Math.abs(facts.durationSeconds - clip.durationSeconds) > 0.001
	)
		throw new ExpectedCliError('Decoded video facts do not match admitted metadata.');
}

function decodedPixels(bytes: Buffer, after: string[], limit: number): Buffer {
	const result = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-max_alloc',
			'67108864',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			...after,
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-pix_fmt',
			'rgb24',
			'-f',
			'rawvideo',
			'pipe:1'
		],
		{ input: bytes, timeout: 20_000, maxBuffer: limit + 1024 }
	);
	if (result.status !== 0 || result.stdout.length !== limit)
		throw new ExpectedCliError('Poster frame decoding failed.');
	return result.stdout;
}
