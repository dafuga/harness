// @harness-uid u_a7rs3z4f6t
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { VerificationStoreRepository } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import { wholeRecordDependencies } from '../../../utils/development-tooling/record-lineage/recordDependencies';
import { VideoReferenceService } from '../VideoReferenceService';

/** Check archive dependencies sequentially, retaining neither batch media nor ancestry media. */
export async function videoReferenceIntegrity(
	root: string,
	record: VerificationRecord
): Promise<string[]> {
	const store = new VerificationStoreRepository(root),
		pending = [record],
		seen = new Set<string>();
	const problems: string[] = [];
	const references = new VideoReferenceService(root, undefined, [], false);
	while (pending.length) {
		const current = pending.pop()!;
		if (seen.has(current.id)) continue;
		seen.add(current.id);
		try {
			await references.materialize(current);
		} catch (error) {
			problems.push(
				`Referenced video integrity failed: ${error instanceof Error ? error.message : 'unavailable proof'}`
			);
		}
		for (const id of wholeRecordDependencies(current)) {
			const found = store.load(id);
			if (found && !seen.has(id)) pending.push(found.record);
		}
	}
	return problems;
}
