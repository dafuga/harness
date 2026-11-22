// @harness-uid u_vkj6mnyah7
import { ExpectedCliError } from '../../../../../core/development-tooling/errors';
import { spawnSync } from 'node:child_process';
import type { MediaFacts } from '../../../../../utils/verification-evidence/mediaFacts';

/** Inspect bounded video bytes before decoding frames in a single-threaded child. */
export function videoFacts(bytes: Buffer): MediaFacts {
	if (bytes.length > 8 * 1024 * 1024) return { error: 'video exceeds the 8 MiB clip cap' };
	try {
		const facts = probeFacts(bytes);
		return { ...facts, frameCount: decodedFrames(bytes, facts.durationSeconds) };
	} catch (error) {
		return { error: `invalid video: ${error instanceof Error ? error.message : 'decode failed'}` };
	}
}

function probeFacts(bytes: Buffer) {
	const metadata = JSON.parse(
		run(
			'ffprobe',
			['-v', 'error', '-show_streams', '-show_format', '-of', 'json', '-i', 'pipe:0'],
			bytes
		)
	);
	if (
		!String(metadata.format?.format_name).split(',').includes('mp4') ||
		bytes.toString('ascii', 4, 8) !== 'ftyp'
	)
		throw new ExpectedCliError('video requires an MP4 container');
	const streams = metadata.streams ?? [];
	if (streams.length !== 1 || streams[0].codec_type !== 'video')
		throw new ExpectedCliError('silent video must contain exactly one video stream');
	return streamFacts(streams[0], Number(metadata.format?.duration ?? streams[0].duration));
}

function streamFacts(stream: Record<string, string | number>, durationSeconds: number) {
	const [numerator, denominator] = String(stream.avg_frame_rate).split('/').map(Number);
	const frameRate = numerator / denominator,
		width = Number(stream.width),
		height = Number(stream.height);
	if (stream.codec_name !== 'h264' || stream.pix_fmt !== 'yuv420p')
		throw new ExpectedCliError('video requires H.264 and yuv420p');
	if (!dimensionsFit(width, height)) throw new ExpectedCliError('video dimensions exceed limits');
	if (!(durationSeconds > 0 && durationSeconds <= 15 && frameRate > 0 && frameRate <= 120))
		throw new ExpectedCliError('video duration or cadence exceeds limits');
	return {
		kind: 'video' as const,
		width,
		height,
		durationSeconds,
		frameRate,
		codec: 'h264' as const,
		pixelFormat: 'yuv420p' as const
	};
}

function decodedFrames(bytes: Buffer, durationSeconds: number): number {
	const decoded = run(
		'ffmpeg',
		[
			'-v',
			'error',
			'-xerror',
			'-max_alloc',
			'67108864',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			'-map',
			'0:v:0',
			'-an',
			'-t',
			'16',
			'-frames:v',
			'2401',
			'-progress',
			'pipe:1',
			'-nostats',
			'-f',
			'null',
			'-'
		],
		bytes
	);
	const frameCount = Number([...decoded.matchAll(/^frame=(\d+)$/gm)].at(-1)?.[1]);
	const decodedSeconds = Number([...decoded.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1]) / 1e6;
	if (!(frameCount > 0 && frameCount <= 2400) || Math.abs(decodedSeconds - durationSeconds) > 0.15)
		throw new ExpectedCliError('decoded frames do not match the retained video interval');
	return frameCount;
}

function dimensionsFit(width: number, height: number): boolean {
	return (
		Number.isInteger(width) &&
		Number.isInteger(height) &&
		width > 0 &&
		height > 0 &&
		width <= 1920 &&
		height <= 1920 &&
		width * height <= 2_073_600
	);
}

function run(program: string, args: string[], input: Buffer): string {
	const child = spawnSync(program, args, { input, timeout: 20_000, maxBuffer: 1_000_000 });
	if (child.error || child.status !== 0)
		throw new ExpectedCliError(`${program} could not inspect video`);
	return child.stdout.toString();
}
