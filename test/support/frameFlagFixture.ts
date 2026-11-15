import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import type {
	FrameClipReader,
	FrameClipReference
} from '../../src/services/verification-evidence/FrameFlagService.types';

export async function frameFlagFixture(root: string, git: (...args: string[]) => string) {
	await writeFile(join(root, '.gitignore'), '.cache/\n');
	await writeFile(join(root, 'README.md'), 'Frame flag fixture');
	git('add', '.');
	git('commit', '-qm', 'feat: add disposable frame fixture');
	const revision = git('rev-parse', 'HEAD');
	const original = encode('testsrc2=size=160x120:rate=10:duration=1');
	const replacement = encode('color=blue:size=160x120:rate=10:duration=1');
	const reference: FrameClipReference = {
		revision,
		record: 'a'.repeat(64),
		unit: 'component.player',
		clipId: 'play',
		viewport: 'desktop'
	};
	let addressed: string[] = [];
	const reader: FrameClipReader = async (ref) => {
		if (![reference.record, 'b'.repeat(64)].includes(ref.record))
			throw new Error('Unknown fixture record');
		const bytes = ref.record === reference.record ? original : replacement;
		return {
			...reference,
			record: ref.record,
			bytes,
			sha256: hash(bytes),
			inputHash: 'c'.repeat(64),
			durationSeconds: 1,
			frameRate: 10,
			width: 160,
			height: 120,
			capturedAt: new Date().toISOString(),
			addressedFlags: ref.record === reference.record ? [] : addressed
		};
	};
	return {
		reference,
		reader,
		original,
		replacement,
		replacementRef: { ...reference, record: 'b'.repeat(64) },
		address: (ids: string[]) => {
			addressed = ids;
		}
	};
}

export function hash(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/** A durable reviewer flag consumed by the task runner without an injected feedback reader. */
export async function seedTaskFrameFlag(root: string, revision: string, unit: string) {
	const bytes = encode('testsrc2=size=160x120:rate=10:duration=1');
	const reference = { revision, record: 'a'.repeat(64), unit, clipId: 'play', viewport: 'desktop' };
	const reader: FrameClipReader = async () => ({
		...reference,
		bytes,
		sha256: hash(bytes),
		inputHash: 'c'.repeat(64),
		durationSeconds: 1,
		frameRate: 10,
		width: 160,
		height: 120,
		capturedAt: new Date().toISOString(),
		addressedFlags: []
	});
	return new FrameFlagService(root, reader).flag({
		clip: reference,
		frameNumber: 2,
		note: 'Inspect this edge before replacing the clip'
	});
}

function encode(source: string): Buffer {
	const result = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-f',
			'lavfi',
			'-i',
			source,
			'-an',
			'-c:v',
			'libx264',
			'-threads',
			'1',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'frag_keyframe+empty_moov',
			'-f',
			'mp4',
			'pipe:1'
		],
		{ timeout: 10_000, maxBuffer: 1_000_000 }
	);
	if (result.status !== 0) throw new Error('Synthetic video fixture failed to encode.');
	return result.stdout;
}
