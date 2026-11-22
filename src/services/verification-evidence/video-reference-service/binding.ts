// @harness-uid u_alfe4qnget
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import type { VideoArchiveClip } from '../VideoArchiveService.types';
import type { VideoReferenceInput } from '../VideoReferenceService.types';
import { posix } from 'node:path';

export function referencePaths(capture: Capture): [string, string] {
	const path = capture.path,
		poster = posix.join(posix.dirname(path), capture.video!.poster.file);
	for (const name of [path, poster])
		if (!safeReferencePath(name))
			throw new ExpectedCliError('Unsafe referenced video capture path.');
	if (path === poster) throw new ExpectedCliError('Video and poster paths conflict.');
	return [path, poster];
}

export function safeReferencePath(path: string): boolean {
	return (
		Boolean(path) &&
		!path.startsWith('/') &&
		!/[\\:]/.test(path) &&
		![...path].some((char) => char.charCodeAt(0) < 32) &&
		path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
	);
}

export function bindReference(input: VideoReferenceInput, clip: VideoArchiveClip): void {
	const { capture } = input,
		{ video } = capture,
		original = clip.original;
	const matches = [
		capture.kind === 'video',
		capture.status === 'passed',
		capture.mediaType === 'video/mp4',
		capture.sha256 === clip.media.sha256,
		capture.bytes === clip.media.bytes,
		capture.state === clip.slot.state,
		capture.viewport === clip.slot.viewport,
		capture.capturedAt === original.capturedAt,
		capture.durationSeconds === clip.durationSeconds,
		capture.server?.revision === original.revision,
		capture.server?.buildId === original.buildId,
		canonicalJson(video) === canonicalJson(clip.video)
	];
	if (matches.includes(false))
		throw new ExpectedCliError(
			'Referenced video metadata/source/build does not match its archived clip.'
		);
	bindReferenceOrigin(input, clip);
	referencePaths(capture);
}

function bindReferenceOrigin(input: VideoReferenceInput, clip: VideoArchiveClip): void {
	const { capture, source } = input,
		original = clip.original;
	if (
		!capture.videoReference?.record &&
		(source.commit !== original.revision || source.tree !== original.tree)
	)
		throw new ExpectedCliError('Fresh video batch does not belong to the current parent source.');
	if (capture.videoReference?.revision && capture.videoReference.revision !== original.revision)
		throw new ExpectedCliError('Reused video reference relabels its original source.');
}

export async function currentOwner(root: string, input: VideoReferenceInput): Promise<string> {
	const git = new GitAdapter(root),
		{ source, capture } = input;
	if (
		(await git.attempt(['rev-parse', '--verify', `${source.commit}^{commit}`])) !== source.commit ||
		(await git.attempt(['rev-parse', '--verify', `${source.commit}^{tree}`])) !== source.tree
	)
		throw new ExpectedCliError('Current parent source identity is not the exact commit/tree.');
	const name = capture.video!.unit;
	if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(name))
		throw new ExpectedCliError('Invalid video owner.');
	const path = `${source.commit}:specification/units/${name}.json`;
	const size = Number(await git.attempt(['cat-file', '-s', path]));
	if (!Number.isSafeInteger(size) || size < 1 || size > 1024 * 1024)
		throw new ExpectedCliError('Video owner source manifest is unavailable.');
	const owner = JSON.parse(await git.run(['show', path], { maxBuffer: 1024 * 1024 }));
	if (owner.id !== name || owner.status !== 'active' || !/^u_[a-z2-7]{10}$/.test(owner.uid))
		throw new ExpectedCliError('Current video owner is not active or has no stable identity.');
	return owner.uid;
}
