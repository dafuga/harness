import { videoReferenceFixture, reusedVideoParent, saveVideoParent } from './videoReferenceFixture';
import { VideoArchiveService } from '../../src/services/verification-evidence/VideoArchiveService';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import { expect } from 'vitest';
import { VideoReferenceService } from '../../src/services/verification-evidence/VideoReferenceService';
import { HistoryStatusService } from '../../src/services/verification-evidence/history-status-service/HistoryStatusService';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import { rm } from 'node:fs/promises';

export async function videoSharedParent(root: string, git: (...args: string[]) => string) {
	const f = await videoReferenceFixture(root, git, true);
	const descriptor = await new VideoArchiveService(root).describe(f.pointers[0]);
	const sibling = descriptor.batch.clips.find((clip) => clip.slot.clipId === 'sibling')!;
	const capture = {
		...f.capture,
		path: 'clips/sibling/clip.mp4',
		video: sibling.video,
		sha256: sibling.media.sha256,
		bytes: sibling.media.bytes
	};
	const { id, ...draft } = f.record;
	void id;
	const parent = sealRecord({
		...draft,
		scenarios: [
			{
				...draft.scenarios[0],
				states: [{ ...draft.scenarios[0].states[0], captures: [f.capture, capture] }]
			}
		]
	});
	const attached = await new EvidenceAttachService(root).attach(
		parent.source.commit,
		await saveVideoParent(root, parent)
	);
	const child = await reusedVideoParent(root, git, parent);
	const captures = [
		child.capture,
		{
			...capture,
			videoReference: {
				batch: f.pointers[0].batch,
				record: parent.id,
				revision: parent.source.commit
			}
		}
	];
	return { ...f, parent, child, captures, evidence: attached.evidence };
}

export async function verifySelectedSibling(
	root: string,
	f: Awaited<ReturnType<typeof videoSharedParent>>
): Promise<void> {
	const sibling = f.captures[1],
		lfs = new LfsAdapter(root);
	await rm(await lfs.path(sibling.sha256));
	const broken = await new HistoryStatusService(root).attached.load(f.evidence);
	expect(broken.problems.join(' ')).toMatch(/missing|integrity/i);
	const service = new VideoReferenceService(root);
	const input = (capture = f.child.capture) => ({
		source: f.child.record.source,
		capture,
		batches: f.pointers
	});
	const proposals = await service.candidates({
		unit: f.capture.video!.unit,
		clipId: f.capture.video!.clipId,
		viewport: f.capture.viewport!,
		inputHash: f.input.video.inputHash
	});
	expect((await service.resolve(input(proposals[0].capture))).origin.record).toBe(f.parent.id);
	await expect(service.resolve(input(sibling))).rejects.toThrow(/missing|integrity/i);
	const attached = await new EvidenceAttachService(root).attach(
		f.child.record.source.commit,
		f.child.stored
	);
	expect((await new HistoryStatusService(root).attached.load(attached.evidence)).problems).toEqual(
		[]
	);
	expect((await new HistoryStatusService(root).status(f.child.record.source.commit)).verified).toBe(
		true
	);
	await lfs.store(f.input.alternateVideo);
	expect((await service.resolve(input(sibling))).origin.record).toBe(f.parent.id);
}
