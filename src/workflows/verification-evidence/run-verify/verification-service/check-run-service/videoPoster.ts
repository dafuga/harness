// @harness-uid u_3exag5gqwq
import { ExpectedCliError } from '../../../../../core/development-tooling/errors';
import { lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { CaptureLine } from '../../../../../core/verification-evidence/verifyTypes';
import type { MediaFacts } from '../../../../../utils/verification-evidence/mediaFacts';
import type { CaptureLimits } from './captureLimits.types';
import type { RecordBudget } from './captureLimits';
import { digestFile, oversizeCapture } from './captureLimits';
import { mediaFacts } from './mediaFacts';

/** Admit the complete pair before either media decoder runs; failed pairs consume no budget. */
export function posterBudget(
	line: CaptureLine,
	file: string,
	scope: { budget: RecordBudget; limits: CaptureLimits; videoBytes: number }
): number {
	const poster = line.video?.poster;
	if (!poster) throw new ExpectedCliError('Video requires its retained poster.');
	const stat = lstatSync(join(dirname(file), poster.file));
	if (!stat.isFile()) throw new ExpectedCliError('Poster must be a regular file, not a symlink.');
	const refusal =
		oversizeCapture(poster.file, stat.size, scope.limits) ??
		scope.budget.refusal(poster.file, stat.size + scope.videoBytes);
	if (refusal || stat.size > 8 * 1024 * 1024)
		throw new ExpectedCliError(refusal ?? 'Poster exceeds the clip cap.');
	return stat.size;
}

/** Compare decoded pixels with the actual retained video frame, independent of PNG encoding. */
export function inspectVideoPoster(
	line: CaptureLine,
	file: string,
	facts: MediaFacts | undefined
): void {
	if (!facts || !('kind' in facts) || facts.kind !== 'video')
		throw new ExpectedCliError('Video is not decodable.');
	const poster = line.video!.poster,
		bytes = checkedPosterBytes(line, file, facts);
	const limit = facts.width * facts.height * 3;
	const pixels = (args: string[], input?: Buffer) => {
		const result = spawnSync(
			'ffmpeg',
			[
				'-v',
				'error',
				'-max_alloc',
				'67108864',
				'-threads',
				'1',
				...args,
				'-frames:v',
				'1',
				'-pix_fmt',
				'rgb24',
				'-f',
				'rawvideo',
				'pipe:1'
			],
			{ input, timeout: 20_000, maxBuffer: limit + 1024 }
		);
		if (result.status !== 0 || result.stdout.length !== limit)
			throw new ExpectedCliError('Poster frame could not be decoded.');
		return result.stdout;
	};
	if (
		!pixels(['-i', 'pipe:0'], bytes).equals(pixels(['-i', file, '-ss', String(poster.timeSeconds)]))
	)
		throw new ExpectedCliError('Poster pixels do not match the declared video frame.');
}

function checkedPosterBytes(
	line: CaptureLine,
	file: string,
	facts: Extract<MediaFacts, { kind: 'video' }>
): Buffer {
	const poster = line.video!.poster,
		path = join(dirname(file), poster.file);
	const digest = digestFile(path, 8 * 1024 * 1024, true),
		bytes = digest.contents!;
	if (digest.sha256 !== poster.sha256 || digest.bytes !== poster.bytes)
		throw new ExpectedCliError('Poster bytes do not match the video reference.');
	if (
		bytes.length < 24 ||
		bytes.readUInt32BE(16) !== facts.width ||
		bytes.readUInt32BE(20) !== facts.height
	)
		throw new ExpectedCliError('Poster dimensions do not match the admitted video.');
	const decoded = mediaFacts(bytes, 'image/png');
	if (!('kind' in decoded) || decoded.kind !== 'image')
		throw new ExpectedCliError('Poster is not a valid PNG.');
	return bytes;
}
