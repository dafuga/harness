import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { videoCaptureFixture } from './videoCaptureFixture';
import { attachCaptureParent } from './videoCaptureParent';
import { assertCaptureIndexOwnership } from './videoCaptureProtocol';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';
import { VideoCaptureService } from '../../src/services/verification-evidence/VideoCaptureService';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import type { TemporaryRepo } from './temporary.types';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';

export async function assertDurableVideoReceipt(repo: TemporaryRepo) {
	const f = await videoCaptureFixture(repo),
		options = f.options();
	const service = new VideoCaptureService(repo.root, { native: f.native.factory });
	const original = await service.record(options);
	expect(original.raw.every((raw) => existsSync(join(raw.directory, 'raw')))).toBe(true);
	expect(existsSync(join(options.directory, original.captures[0].path))).toBe(false);
	expect(
		JSON.parse(readFileSync(join(options.directory, 'video-batches.json'), 'utf8')).captures
	).toHaveLength(2);
	await expect(service.acknowledgeDirectory(options.directory, 'a'.repeat(64))).rejects.toThrow(
		/attached|receipt/
	);
	expect(f.native.acknowledge).not.toHaveBeenCalled();
	const parent = await attachCaptureParent(repo, original);
	await service.acknowledgeDirectory(options.directory, parent.id);
	expect(f.native.acknowledge).toHaveBeenCalledTimes(2);
	const flags = new FrameFlagService(repo.root),
		flag = await flags.flag({
			clip: {
				record: parent.id,
				revision: original.source.commit,
				unit: 'component.player',
				clipId: 'first',
				viewport: 'desktop'
			},
			frameNumber: 10,
			note: 'Review the actual retained frame before replacement'
		});
	expect(flag.id).toMatch(/^[a-f0-9-]{36}$/);
	const replacementOptions = f.options();
	const replacement = await service.record({
		...replacementOptions,
		loadScript: async (input) => ({
			...(await f.native.loadScript(input)),
			addressedFlags: [flag.id]
		})
	});
	expect(replacement.raw[0].addressedFlags).toEqual([flag.id]);
	const next = await attachCaptureParent(repo, replacement);
	await assertResolvedReceiptFlag(repo.root, next, flag.id);
	await expect(
		service.acknowledgeDirectory(replacementOptions.directory, next.id)
	).resolves.toBeUndefined();
	expect(replacement.raw.every((raw) => !existsSync(join(raw.directory, 'raw')))).toBe(true);
	expect(
		f.native.produced.every((item) => existsSync(item.video.path) && existsSync(item.poster.path))
	).toBe(true);
	f.publish(replacement);
	await assertCaptureIndexOwnership(f);
}
async function assertResolvedReceiptFlag(root: string, record: VerificationRecord, flag: string) {
	expect(await new HistoryNoteRepository(root).text(record.source.commit)).toContain(record.id);
	expect(
		(await new FrameFlagService(root).list('component.player')).find((item) => item.id === flag)
			?.status
	).toBe('resolved');
}
