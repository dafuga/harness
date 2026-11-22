// @harness-uid u_a7rs3z4f6t
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { readFrameFlags } from '../frame-flag-service/flagStore';
import { attachedVideoFlagFailure } from '../evidence-attach-service/attachedVideoFlagChecks';

/** A formerly passing record cannot satisfy today's gate while its recorded slots need review. */
export async function videoFlagProofFailures(
	root: string,
	record: VerificationRecord
): Promise<string[]> {
	const captures = record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.kind === 'video' && capture.video);
	if (!captures.length) return [];
	try {
		const flags = await readFrameFlags(root);
		return captures.flatMap((capture) => {
			const failure = attachedVideoFlagFailure(record.id, capture, flags);
			return failure ? [`video clip ${capture.video!.clipId}/${capture.viewport}: ${failure}`] : [];
		});
	} catch (error) {
		return [
			`Video reviewer flags cannot be proved: ${error instanceof Error ? error.message : 'invalid retained feedback'}`
		];
	}
}
