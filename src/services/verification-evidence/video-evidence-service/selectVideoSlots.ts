// @harness-uid u_nfctcgnv7g
import type { VideoSlot, VideoPlan } from '../VideoEvidenceService.types';
/** The canonical metadata predicate used by planning and verified capture orchestration. */
export function selectVideoSlots(slots: VideoSlot[], previous: VideoSlot[]): VideoPlan {
	const record: VideoSlot[] = [],
		reuse: VideoSlot[] = [];
	for (const slot of slots) {
		const match = previous.find(
			(old) =>
				!slot.reasons?.some((reason) => reason.includes('recording required')) &&
				old.unit === slot.unit &&
				old.clipId === slot.clipId &&
				old.viewport === slot.viewport &&
				old.inputHash === slot.inputHash
		);
		if (match) reuse.push(match);
		else record.push(slot);
	}
	return { record, reuse };
}
