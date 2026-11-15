import { expect } from 'vitest';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { VideoReferenceService } from '../../src/services/verification-evidence/VideoReferenceService';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { referenceRecord, saveVideoParent } from './videoReferenceFixture';
import { scopeFailure } from '../../src/workflows/verification-evidence/run-verify/verification-service/entityScope';

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
