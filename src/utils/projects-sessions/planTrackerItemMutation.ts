// @harness-uid u_4pgfvaopdt
import type {
	TrackerItemMutation,
	TrackerItemMutationContext,
	TrackerItemMutationPlan
} from './planTrackerItemMutation.types';

export function planTrackerItemMutation<Receipt extends object>(
	request: TrackerItemMutation<Receipt>,
	_context: TrackerItemMutationContext
): TrackerItemMutationPlan<Receipt> {
	return { itemId: request.action === 'add' ? request.itemId : request.item.id, fields: {} };
}
