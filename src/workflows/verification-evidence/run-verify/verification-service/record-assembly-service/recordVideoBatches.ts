// @harness-uid u_33ugo6gwgh
import { canonicalJson } from '../../../../../utils/development-tooling/canonicalJson';
import type { CheckOutcome } from '../check-run-service/CheckRunService.types';
import type { VideoBatchPointer } from '../../../../../utils/verification-evidence/videoClipSchema.types';

/** Gathered pointers already passed authoritative media and current-slot proof. */
export function recordVideoBatches(outcomes: CheckOutcome[]): {
	videoBatches?: VideoBatchPointer[];
} {
	const byId = new Map<string, VideoBatchPointer>();
	for (const pointer of outcomes.flatMap((outcome) => outcome.videoBatches ?? [])) {
		const prior = byId.get(pointer.batch);
		if (prior && canonicalJson(prior) !== canonicalJson(pointer))
			throw new Error('Video batch pointer identity conflicts across checks.');
		byId.set(pointer.batch, pointer);
	}
	return byId.size ? { videoBatches: [...byId.values()] } : {};
}
