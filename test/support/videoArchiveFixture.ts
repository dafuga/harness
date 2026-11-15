import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { frameFlagFixture, hash } from './frameFlagFixture';
import type { VideoArchiveInput } from '../../src/services/verification-evidence/VideoArchiveService.types';

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
		{ input: f.original, timeout: 10_000, maxBuffer: 1_000_000 }
	);
	if (poster.status !== 0) throw new Error('Archive poster fixture failed.');
	const input: VideoArchiveInput = {
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
				sha256: hash(poster.stdout),
				bytes: poster.stdout.length,
				timeSeconds: 0
			}
		},
		durationSeconds: 1,
		sha256: hash(f.original),
		videoBytes: f.original,
		posterBytes: poster.stdout
	};
	return input;
}
