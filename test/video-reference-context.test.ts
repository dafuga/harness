import { expect, test, vi } from 'vitest';
import { withTempRepo } from './support/temporary';
import { videoSharedParent } from './support/videoSharedParent';
import { VideoReferenceService } from '../src/services/verification-evidence/VideoReferenceService';
import { VideoArchiveService } from '../src/services/verification-evidence/VideoArchiveService';
import { AttachedRecordService } from '../src/services/verification-evidence/history-status-service/attached-record-service/AttachedRecordService';
import { EvidenceBranchRepository } from '../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { LfsAdapter } from '../src/adapters/git-source-history/LfsAdapter';
import { rm } from 'node:fs/promises';

test('video-reference-context', async () => {
	await withTempRepo(async ({ root, git }) => {
		const f = await videoSharedParent(root, git),
			service = new VideoReferenceService(root);
		const read = vi.spyOn(VideoArchiveService.prototype, 'readClip');
		const describe = vi.spyOn(AttachedRecordService.prototype, 'describe');
		const input = (capture = f.captures[0]) => ({
			source: f.child.record.source,
			capture,
			batches: f.pointers
		});
		try {
			for (const capture of f.captures)
				expect((await service.resolve(input(capture))).origin.record).toBe(f.parent.id);
			expect(read.mock.calls.length, 'shared-parent proof reads grow linearly').toBeLessThanOrEqual(
				4
			);
			describe.mockClear();
			const selection = (clipId: string) => ({
				unit: f.capture.video!.unit,
				clipId,
				viewport: f.capture.viewport!,
				inputHash: f.input.video.inputHash
			});
			const first = await service.candidates(selection('play'));
			await service.candidates(selection('sibling'));
			first[0].capture.video!.inputHash = 'd'.repeat(64);
			expect((await service.candidates(selection('play')))[0].capture.video!.inputHash).toBe(
				f.input.video.inputHash
			);
			expect(
				describe.mock.calls.length,
				'candidate descriptor discovery is shared per pin'
			).toBeLessThanOrEqual(1);
			const before = read.mock.calls.length;
			await new EvidenceBranchRepository(root).add(
				'context-test',
				[{ path: 'marker.txt', content: { bytes: 'new pin' } }],
				'feat: change disposable evidence pin',
				'marker.txt'
			);
			await service.resolve(input());
			expect(
				read.mock.calls.length - before,
				'an unpinned service rechecks a changed evidence scope'
			).toBeGreaterThanOrEqual(3);
			await rm(await new LfsAdapter(root).path(f.capture.sha256));
			const retry = new VideoReferenceService(root);
			expect(
				await retry.resolve(input(f.captures[1])).then(
					() => false,
					() => true
				)
			).toBe(true);
			await new LfsAdapter(root).store(f.input.videoBytes);
			expect((await retry.resolve(input(f.captures[1]))).origin.record).toBe(f.parent.id);
		} finally {
			read.mockRestore();
			describe.mockRestore();
		}
	});
}, 30_000);
