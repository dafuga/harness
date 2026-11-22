// @harness-uid u_je3x2iwj7f
import type {
	PlanDetail,
	ThreadMessage
} from '../../../../models/planning-collaboration/Planning.types';
import { optionOf } from '../../../../utils/planOptions';
import { fail } from '../../../../utils/planning-collaboration/planData';

export function validateThreadReference(
	reference: ThreadMessage['references'][number],
	plan: PlanDetail
): void {
	if (reference.kind === 'approval' && plan.approvals.some((a) => a.id === reference.approvalId))
		return;
	if (
		reference.kind === 'notes' &&
		plan.versions.some(
			(v) => v.version === reference.version && v.notes && v.notes.sha256 === reference.sha256
		)
	)
		return;
	if (
		reference.kind === 'image' &&
		plan.versions.some(
			(v) =>
				v.version === reference.version &&
				v.images.some((i) => i.file === reference.file && i.sha256 === reference.sha256) &&
				(reference.option === undefined || optionOf(v, reference.file) === reference.option)
		)
	)
		return;
	fail('invalid-input', 'Reference is not an artifact of this entity');
}
