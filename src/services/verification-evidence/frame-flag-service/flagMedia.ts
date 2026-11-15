// @harness-uid u_zhz7hjx43x
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readFlagFrame } from './readFlagFrame';
import { readFrameCapture } from './readFrameCapture';
import type { PinnedHistory } from '../history-status-service/HistoryStatusService.types';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import { frameHash } from './flagSchema';
import type {
	FrameClip,
	FrameClipReference,
	FrameFlag,
	FrameVideoFacts
} from '../FrameFlagService.types';

/** Follow only a verification note on the requested source, within the current evidence history. */
export async function defaultAttachedReader(
	reference: FrameClipReference,
	root: string = process.cwd(),
	pinned?: PinnedHistory
): Promise<FrameClip> {
	const { capture, bytes } = await readFrameCapture(root, reference, pinned);
	const video = capture.video!;
	return {
		...reference,
		bytes,
		sha256: capture.sha256,
		inputHash: video.inputHash,
		durationSeconds: capture.durationSeconds!,
		frameRate: video.frameRate,
		width: video.width,
		height: video.height,
		capturedAt: capture.capturedAt,
		addressedFlags: video.addressedFlags ?? []
	};
}

export function inspectFrameClip(clip: FrameClip): FrameVideoFacts {
	const facts = mediaFacts(clip.bytes, 'video/mp4');
	if (!('kind' in facts) || facts.kind !== 'video')
		throw new ExpectedCliError('Attached video is corrupt or exceeds the bounded video limits.');
	const matches = [
		facts.width === clip.width,
		facts.height === clip.height,
		Math.abs(facts.durationSeconds - clip.durationSeconds) < 0.000001,
		Math.abs(facts.frameRate - clip.frameRate) < 0.000001
	];
	if (matches.includes(false))
		throw new ExpectedCliError('Actual video facts contradict attached metadata.');
	return facts;
}

export function extractFlagFrame(clip: FrameClip, frameNumber: number): Buffer {
	const child = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-nostdin',
			'-xerror',
			'-max_alloc',
			'67108864',
			'-protocol_whitelist',
			'pipe',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			'-map',
			'0:v:0',
			'-an',
			'-filter_threads',
			'1',
			'-vf',
			`select=eq(n\\,${frameNumber})`,
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-c:v',
			'png',
			'-f',
			'image2pipe',
			'pipe:1'
		],
		{ input: clip.bytes, timeout: 20_000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 }
	);
	if (child.error || child.status !== 0)
		throw new ExpectedCliError('Exact video frame extraction failed or exceeded its bounds.');
	const facts = inspectFlagPng(child.stdout);
	if (facts.width !== clip.width || facts.height !== clip.height)
		throw new ExpectedCliError('Extracted frame dimensions contradict the original video.');
	return child.stdout;
}

export function inspectFlagPng(bytes: Buffer) {
	if (bytes.length < 24 || bytes.length > 8 * 1024 * 1024)
		throw new ExpectedCliError('Corrupt or oversized frame PNG.');
	const width = bytes.readUInt32BE(16),
		height = bytes.readUInt32BE(20);
	if (width > 1920 || height > 1920 || width * height > 2_073_600)
		throw new ExpectedCliError('Frame PNG dimensions exceed the video limits.');
	try {
		const facts = mediaFacts(bytes, 'image/png');
		if (!('kind' in facts) || facts.kind !== 'image') throw new ExpectedCliError('invalid PNG');
		return facts;
	} catch {
		throw new ExpectedCliError('Frame PNG is corrupt or cannot be decoded.');
	}
}

export async function materializeFlagFrame(
	root: string,
	flag: FrameFlag,
	directory: string
): Promise<string> {
	const bytes = await retainedFlagFrame(root, flag);
	const target = resolve(directory);
	await mkdir(target, { recursive: true });
	if (!(await lstat(target)).isDirectory())
		throw new ExpectedCliError('Feedback directory is not a regular directory.');
	const path = join(target, `${flag.id}.png`);
	await writeFrameInput(path, bytes);
	if (!(await lstat(path)).isFile() || frameHash(await readFile(path)) !== flag.frame.sha256)
		throw new ExpectedCliError('Materialized feedback frame hash/integrity failed.');
	return path;
}

/** Serve and attach only the exact retained, hash-verified PNG. */
export async function retainedFlagFrame(root: string, flag: FrameFlag): Promise<Buffer> {
	const bytes = await readFlagFrame(root, flag);
	if (bytes?.length !== flag.frame.bytes || frameHash(bytes) !== flag.frame.sha256)
		throw new ExpectedCliError('Retained frame hash/integrity is corrupt or unavailable.');
	inspectFlagPng(bytes);
	return bytes;
}

async function writeFrameInput(path: string, bytes: Buffer): Promise<void> {
	try {
		await writeFile(path, bytes, { flag: 'wx' });
	} catch (error) {
		if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
			throw new ExpectedCliError(
				'Feedback frame could not be written to the task input directory.'
			);
	}
}
