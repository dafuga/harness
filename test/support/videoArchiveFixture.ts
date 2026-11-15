import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { frameFlagFixture, hash } from './frameFlagFixture';
import type {
	VideoArchiveInput,
	VideoArchiveClip
} from '../../src/services/verification-evidence/VideoArchiveService.types';

export async function videoArchiveFixture(root: string, git: (...args: string[]) => string) {
	const f = await frameFlagFixture(root, git);
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await writeFile(
		join(root, 'specification/units/component.player.json'),
		JSON.stringify({
			schemaVersion: 1,
			id: 'component.player',
			uid: 'u_abcdefghij',
			kind: 'component',
			status: 'active',
			owns: { source: ['README.md'], symbols: [] }
		})
	);
	git('add', '.');
	git('commit', '-qm', 'feat: register disposable archive owner');
	return {
		...archiveInput(git, f.original, archivePoster(f.original)),
		alternatePoster: archivePoster(f.replacement)
	};
}

function archivePoster(bytes: Buffer): Buffer {
	const poster = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-f',
			'image2pipe',
			'-vcodec',
			'png',
			'pipe:1'
		],
		{ input: bytes, timeout: 10_000, maxBuffer: 1_000_000 }
	);
	if (poster.status !== 0) throw new Error('Archive poster fixture failed.');
	return poster.stdout;
}

function archiveInput(
	git: (...args: string[]) => string,
	bytes: Buffer,
	poster: Buffer
): VideoArchiveInput {
	return {
		slot: {
			unit: 'component.player',
			unitUid: 'u_abcdefghij',
			clipId: 'play',
			state: 'playing',
			viewport: 'desktop',
			profile: 'normal'
		},
		original: {
			revision: git('rev-parse', 'HEAD'),
			tree: git('rev-parse', 'HEAD^{tree}'),
			buildId: 'b'.repeat(64),
			capturedAt: '2026-11-15T18:00:00.000Z'
		},
		video: {
			schemaVersion: 1,
			unit: 'component.player',
			clipId: 'play',
			inputHash: 'c'.repeat(64),
			entry: 'playing',
			exit: 'playing',
			states: [{ id: 'playing', atSeconds: 0 }],
			edges: [],
			profile: 'normal',
			width: 160,
			height: 120,
			frameRate: 10,
			sourceFrameRate: 10,
			frameCount: 10,
			poster: {
				file: 'poster.png',
				sha256: hash(poster),
				bytes: poster.length,
				timeSeconds: 0
			}
		},
		durationSeconds: 1,
		sha256: hash(bytes),
		videoBytes: bytes,
		posterBytes: poster
	};
}

/** Metadata-only examples exercise the 512 MiB boundary without allocating media. */
export function videoArchiveBudgetExamples(clip: VideoArchiveClip): VideoArchiveClip[] {
	return Array.from({ length: 33 }, (_, i) => ({
		...clip,
		slot: { ...clip.slot, viewport: `view-${i}` },
		media: {
			path: `media/${String(i * 2).padStart(64, '0')}.mp4`,
			sha256: String(i * 2).padStart(64, '0'),
			bytes: 8 * 1024 * 1024
		},
		poster: {
			path: `media/${String(i * 2 + 1).padStart(64, '0')}.png`,
			sha256: String(i * 2 + 1).padStart(64, '0'),
			bytes: 8 * 1024 * 1024
		}
	}));
}

export function invalidVideoArchiveInputs(
	input: VideoArchiveInput,
	alternate: Buffer
): VideoArchiveInput[] {
	return [
		{ ...input, sha256: '0'.repeat(64) },
		{ ...input, videoBytes: Buffer.alloc(8 * 1024 * 1024 + 1) },
		{ ...input, posterBytes: Buffer.from('bad PNG') },
		{
			...input,
			posterBytes: alternate,
			video: {
				...input.video,
				poster: { ...input.video.poster, sha256: hash(alternate), bytes: alternate.length }
			}
		},
		{ ...input, posterBytes: Buffer.alloc(8 * 1024 * 1024 + 1) },
		{ ...input, slot: { ...input.slot, unit: '../escape' } },
		{ ...input, slot: { ...input.slot, unitUid: 'u_aaaaaaaaaa' } },
		{ ...input, original: { ...input.original, tree: '0'.repeat(40) } },
		{ ...input, video: { ...input.video, width: 162 } },
		{ ...input, video: { ...input.video, states: [{ id: 'playing', atSeconds: 2 }] } }
	];
}
