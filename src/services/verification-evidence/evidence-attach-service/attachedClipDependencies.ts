// @harness-uid u_rfumv65ikl
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { VideoReferenceService } from '../VideoReferenceService';

/** Clip parents are already attached by definition; an absent disposable cache is not their proof. */
export async function attachedClipDependency(
	root: string,
	record: VerificationRecord,
	id: string
): Promise<boolean> {
	const captures = record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.videoReference?.record === id);
	if (!captures.length) return false;
	const service = new VideoReferenceService(root);
	for (const capture of captures)
		await service.resolve({ source: record.source, capture, batches: record.videoBatches ?? [] });
	return true;
}
