import { expect } from 'vitest';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { VideoReferenceService } from '../../src/services/verification-evidence/VideoReferenceService';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { referenceRecord, saveVideoParent } from './videoReferenceFixture';
import { scopeFailure } from '../../src/workflows/verification-evidence/run-verify/verification-service/entityScope';
import { HistoryStatusService } from '../../src/services/verification-evidence/history-status-service/HistoryStatusService';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import type { EvidencePointer } from '../../src/core/git-source-history/historyTypes';
import { rm } from 'node:fs/promises';

export async function rejectVideoOriginStandings(
	root: string,
	scoped: VerificationRecord,
	child: VerificationRecord
): Promise<void> {
	const attach = new EvidenceAttachService(root),
		capture = scoped.scenarios[0].states[0].captures[0];
	const wrong = referenceRecord({
		source: scoped.source,
		capture: capture,
		pointers: scoped.videoBatches!,
		components: scoped.components,
		failures: [scopeFailure('component.other')]
	});
	const failed = referenceRecord({
		source: scoped.source,
		capture: capture,
		pointers: scoped.videoBatches!,
		components: scoped.components,
		failures: ['Actual failure']
	});
	for (const origin of [wrong, failed]) {
		await attach.attach(origin.source.commit, await saveVideoParent(root, origin));
		const capture = {
			...child.scenarios[0].states[0].captures[0],
			videoReference: {
				...child.scenarios[0].states[0].captures[0].videoReference!,
				record: origin.id
			}
		};
		await expect(
			new VideoReferenceService(root).resolve({
				source: child.source,
				capture,
				batches: scoped.videoBatches!
			})
		).rejects.toThrow(/pass|scope|owner/i);
	}
}

export async function verifyMissingMediaDiscovery(
	root: string,
	record: VerificationRecord,
	pointer: EvidencePointer
): Promise<void> {
	const capture = record.scenarios[0].states[0].captures[0];
	const streamed = await new HistoryStatusService(root, undefined, {
		retainMedia: false
	}).attached.load(pointer);
	expect(streamed.problems).toEqual([]);
	expect(streamed.files.size).toBe(0);
	await rm(await new LfsAdapter(root).path(capture.sha256));
	const service = new VideoReferenceService(root);
	const proposals = await service.candidates({
		unit: capture.video!.unit,
		clipId: capture.video!.clipId,
		viewport: capture.viewport!,
		inputHash: capture.video!.inputHash
	});
	expect(proposals[0].capture.videoReference).toMatchObject({
		record: record.id,
		revision: record.source.commit
	});
	await expect(
		service.resolve({
			source: record.source,
			capture: proposals[0].capture,
			batches: proposals[0].batches
		})
	).rejects.toThrow(/missing|integrity/i);
	const broken = await new HistoryStatusService(root, undefined, {
		retainMedia: false
	}).attached.load(pointer);
	expect(broken.problems.join(' ')).toMatch(/missing|integrity/i);
}
