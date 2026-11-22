import { expect, test, vi } from 'vitest';
import { withTempRepo } from './support/temporary';
import { videoSharedParent, verifySelectedSibling } from './support/videoSharedParent';
import { VideoReferenceService } from '../src/services/verification-evidence/VideoReferenceService';
import { VideoArchiveService } from '../src/services/verification-evidence/VideoArchiveService';
import { AttachedRecordService } from '../src/services/verification-evidence/history-status-service/attached-record-service/AttachedRecordService';
import { EvidenceBranchRepository } from '../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import type { Capture } from '../src/core/verification-evidence/verificationTypes';
import type { VideoReferenceSelection } from '../src/services/verification-evidence/VideoReferenceService.types';

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
			expect
				.soft(read.mock.calls.length, 'only selected clip media is read')
				.toBeLessThanOrEqual(2);
			expect.soft(describe.mock.calls.length, 'shared-parent descriptor proof is reused').toBe(1);
			describe.mockClear();
			const selection = (clipId: string) => selectionFor(f.capture, clipId);
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
			await changeEvidencePin(root);
			await service.resolve(input());
			expect(
				read.mock.calls.length - before,
				'an unpinned service rechecks a changed evidence scope'
			).toBeGreaterThanOrEqual(1);
			await verifySelectedSibling(root, f);
		} finally {
			read.mockRestore();
			describe.mockRestore();
		}
	});
}, 30_000);

async function changeEvidencePin(root: string): Promise<void> {
	await new EvidenceBranchRepository(root).add(
		'context-test',
		[{ path: 'marker.txt', content: { bytes: 'new pin' } }],
		'feat: change disposable evidence pin',
		'marker.txt'
	);
}

function selectionFor(capture: Capture, clipId: string): VideoReferenceSelection {
	return {
		unit: capture.video!.unit,
		clipId,
		viewport: capture.viewport!,
		inputHash: capture.video!.inputHash
	};
}
