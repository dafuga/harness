// @harness-uid u_3exag5gqwq
import { canonicalJson } from '../../../../utils/development-tooling/canonicalJson';
import type { Gathered } from '../../../../utils/verification-evidence/gatherCaptures';
import type { CoverageInput } from '../../../../utils/verification-evidence/scenarioCoverage.types';

const proofs = new WeakMap<Gathered, { commit: string; inputHash: string; seal: string }>();

/** Only the parent process can mint this after authoritative archive and current-input admission. */
export function admitVideoReference(item: Gathered, commit: string, inputHash: string): void {
	proofs.set(item, { commit, inputHash, seal: admissionSeal(item) });
}

/** Serialized references and copies of an admitted object carry no authority. */
export function trustedVideoReference(input: CoverageInput, item: Gathered): boolean {
	const proof = proofs.get(item),
		video = item.capture.video;
	return !!(
		proof &&
		video &&
		item.capture.videoReference?.record &&
		proof.commit === input.commit &&
		proof.seal === admissionSeal(item) &&
		proof.inputHash === video.inputHash &&
		input.videoSlots?.some(
			(slot) =>
				slot.unit === video.unit &&
				slot.clipId === video.clipId &&
				slot.viewport === item.capture.viewport &&
				slot.inputHash === proof.inputHash
		)
	);
}
function admissionSeal(item: Gathered): string {
	return canonicalJson({ capture: item.capture, line: item.line, facts: item.facts });
}
