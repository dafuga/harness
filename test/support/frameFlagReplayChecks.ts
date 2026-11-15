import { expect, vi } from 'vitest';
import { writeFile, rm, symlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import { EvidenceBranchRepository } from '../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import type { FrameFlag } from '../../src/services/verification-evidence/FrameFlagService.types';
import { hash } from './frameFlagFixture';

/** Even an intact event path cannot stand in for an attached, verified replacement. */
export async function assertForgedFrameResolution(root: string, flag: FrameFlag) {
	const event = {
		schemaVersion: 1,
		flag: flag.id,
		replacement: { ...flag.clip, record: 'f'.repeat(64), revision: 'e'.repeat(40) },
		addressedFlags: [flag.id]
	};
	await new EvidenceBranchRepository(root).add(
		`${flag.evidence.path}/resolutions/${hash(Buffer.from(JSON.stringify(event)))}`,
		[{ path: 'resolution.json', content: { bytes: JSON.stringify(event) + '\n' } }],
		'chore: forged resolution fixture',
		'resolution.json'
	);
	const service = new FrameFlagService(root);
	await expect(
		service.list(flag.clip.unit),
		'unattached resolution metadata must not clear pending frame feedback'
	).rejects.toThrow(/attach|record|resolution|evidence/i);
	await expect(
		service.feedback(flag.clip.unit, join(root, '.cache/replay-inputs'))
	).rejects.toThrow();
}

/** Corrupt on-disk objects are rejected before the generic unbounded LFS read. */
export async function assertRetainedFrameReadBounds(
	root: string,
	flag: FrameFlag,
	service: FrameFlagService
) {
	const lfs = new LfsAdapter(root),
		path = await lfs.path(flag.frame.sha256);
	const retained = await lfs.read(flag.frame.sha256);
	if (!retained) throw Error('Missing retained fixture PNG');
	await writeFile(path, Buffer.alloc(9 * 1024 * 1024));
	const reads = vi.spyOn(LfsAdapter.prototype, 'read');
	try {
		await expect(service.frame(flag.clip.unit, flag.id)).rejects.toThrow(
			/hash|integrity|corrupt|size|bound/i
		);
		expect(
			reads,
			'oversized retained frames must be rejected before allocating their bytes'
		).not.toHaveBeenCalled();
		await rm(path);
		await mkdir(join(root, '.cache'), { recursive: true });
		const target = join(root, '.cache/symlink-frame.png');
		await writeFile(target, retained);
		await symlink(target, path);
		await expect(
			service.frame(flag.clip.unit, flag.id),
			'retained frame objects must not follow symlinks'
		).rejects.toThrow();
	} finally {
		reads.mockRestore();
	}
}
