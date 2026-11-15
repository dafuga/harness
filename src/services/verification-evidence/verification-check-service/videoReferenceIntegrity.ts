// @harness-uid u_a7rs3z4f6t
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { VerificationStoreRepository } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import { recordDependencies } from '../../../utils/development-tooling/record-lineage/recordDependencies';
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
	while (pending.length) {
		const current = pending.pop()!;
		if (seen.has(current.id)) continue;
		seen.add(current.id);
		try {
			await new VideoReferenceService(root).materialize(current);
		} catch (error) {
			problems.push(
				`Referenced video integrity failed: ${error instanceof Error ? error.message : 'unavailable proof'}`
			);
		}
		for (const id of recordDependencies(current)) {
			const found = store.load(id);
			if (found && !seen.has(id)) pending.push(found.record);
		}
	}
	return problems;
}
